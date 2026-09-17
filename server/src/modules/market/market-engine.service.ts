// ── 行情引擎:轮询真实公开行情 + 轮播播报 ─────────────────────────
// 当前 watchlist 全走 CoinGecko 一次批量(币种 + xStocks 链上股票,带 24h
// 涨跌),默认 5 分钟一轮(MARKET_POLL_MS 可调)。标的表在 watchlist.ts;
// yahoo spark(美股,带当日 5m 序列,429 自动切 TradingView 备胎)路径保留,
// watchlist 无 stock 条目时由空列表守卫整轮休眠。
//
// 播报是轮播:每 ~12s(旧前端节奏 10.4s+抖动)按 watchlist 顺序报下一个
// 标的的最新拉取值,不做异动判定——16 个标的轮一圈 ≈3.2 分钟,远大于
// 5 分钟拉取周期,每次重现必是新值。
//
// 真数据只增不改假:某源拉取失败时,该源标的价格冻结在旧值、不发 tick;
// 429 走专属退避(5min 起,倍增至 30min 封顶,成功即复位)。美股闭市时
// 价格不动,轮播照走(报的是收盘定格值)。前端离线镜像
// (newboy/src/lib/market/local-engine.ts)仍是随机游走,两边数值不追
// 一致,只追形状一致(同一套契约类型)。

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Subject } from "rxjs";
import type { AlertPayload, Quote, StreamEvent, TickQuote } from "./dto";
import {
  RateLimitedError,
  fetchCoinGecko,
  fetchTradingView,
  fetchYahooSpark,
  type RawQuote,
} from "./market-providers";
import { WATCHLIST, type WatchEntry } from "./watchlist";

// 默认 5 分钟一轮(0.2 req/min):免 key 公共限额经不起持续 2/min 的长跑
// (2026-09-11 实测 CoinGecko 撑了一个多小时后开始间歇 429)。轮播读的是
// 内存缓存,不受拉取节奏影响;美股 sparkline 本身来自 Yahoo 的当日 5m
// 序列,拉得疏也不损失走势分辨率,只有加密的累积线窗口变长。
const POLL_MS = Number(process.env.MARKET_POLL_MS ?? 300_000) || 300_000;
const HIST_MAX = 40;
/** 开场 2.6s 就来第一条,别让访客干等(前端原节奏) */
const FIRST_ALERT_MS = 2600;
// 前端原节奏(在场 7.8s + 退场 0.42s + 空档)换算的轮播间隔
const ROTATE_MIN_MS = 10_400;
const ROTATE_JITTER_MS = 3_600;
const BACKOFF_BASE_MS = 5 * 60_000;
const BACKOFF_MAX_MS = 30 * 60_000;
/** ready() 最多等首轮拉取这么久,别让 quotes 首请求干等 */
const READY_TIMEOUT_MS = 8_000;

interface SymState {
  price: number;
  prevClose: number;
  /** 日内(美股)/24h(加密)涨跌幅 */
  dayPct: number;
  /** 最后真实成交时间(Yahoo);加密恒为拉取时刻 */
  marketTime: number;
  /** sparkline 窗口:美股=当日 5m 序列尾段;加密/备胎=逐轮累积 */
  hist: number[];
}

const iso = () => new Date().toISOString();

@Injectable()
export class MarketEngineService implements OnModuleInit, OnModuleDestroy {
  /** tick/alert 事件总线;SSE 每连接复用,快照在连接时单独取 */
  readonly events$ = new Subject<StreamEvent>();

  private readonly logger = new Logger(MarketEngineService.name);
  private state = new Map<string, SymState>();
  private seq = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private rotateIdx = 0;
  private inflight: Promise<void> | null = null;

  // 429 退避,按源独立:退避期内跳过该源,时间戳过了自然恢复
  private yahooBackoffUntil = 0;
  private cgBackoffUntil = 0;
  private yahooNextBackoff = BACKOFF_BASE_MS;
  private cgNextBackoff = BACKOFF_BASE_MS;

  // 首次成功拉取的 Promise,供 ready() 等待
  private hasData = false;
  private successResolve!: () => void;
  private readonly firstSuccess = new Promise<void>((r) => (this.successResolve = r));

  onModuleInit(): void {
    void this.poll();
    this.pollTimer = setInterval(() => void this.poll(), POLL_MS);
    this.scheduleRotation(FIRST_ALERT_MS);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    this.events$.complete();
  }

  /** 首次拉取成功前,quotes 最多阻塞这么久(news"空缓存同步等一轮"范式) */
  async ready(): Promise<void> {
    if (this.hasData) return;
    await Promise.race([
      this.firstSuccess,
      new Promise((r) => setTimeout(r, READY_TIMEOUT_MS)),
    ]);
  }

  /** 全量快照(含 hist 与日内涨跌,行情窗用);尚未拉到过数据时为空 */
  snapshot(): Quote[] {
    return WATCHLIST.flatMap((e) => {
      const st = this.state.get(e.id);
      return st ? [{ id: e.id, price: st.price, hist: [...st.hist], dayPct: st.dayPct }] : [];
    });
  }

  private poll(): Promise<void> {
    if (this.inflight) return this.inflight; // 上一轮还没落地就跳过本轮
    this.inflight = this.doPoll().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async doPoll(): Promise<void> {
    const now = Date.now();
    // 无该类条目 = 该源整轮休眠,别拿空参数去撞 API(当前 watchlist 无 stock,
    // yahoo/TradingView 借此彻底静默;加回 stock 条目即自动恢复)
    const yahooSyms = WATCHLIST.flatMap((e) => (e.kind === "stock" ? [e.yahoo] : []));
    const cgIds = WATCHLIST.flatMap((e) => (e.kind === "crypto" ? [e.cg] : []));
    const yahooSkip = this.yahooBackoffUntil > now || yahooSyms.length === 0;
    const cgSkip = this.cgBackoffUntil > now || cgIds.length === 0;

    const [yRes, cRes] = await Promise.allSettled([
      yahooSkip ? null : fetchYahooSpark(yahooSyms),
      cgSkip ? null : fetchCoinGecko(cgIds),
    ]);

    const changed: TickQuote[] = [];
    if (yRes.status === "fulfilled" && yRes.value) {
      this.yahooBackoffUntil = 0;
      this.yahooNextBackoff = BACKOFF_BASE_MS;
      for (const e of WATCHLIST) {
        if (e.kind === "stock") this.applyQuote(e, (yRes.value as Map<string, RawQuote>).get(e.yahoo), changed, now);
      }
    } else if (yRes.status === "rejected") {
      this.onSourceError("yahoo", yRes.reason, now);
      // Yahoo 失败 → TradingView 免 key 批量补位(15min 延迟,无盘中序列)
      try {
        const tv = await fetchTradingView(
          WATCHLIST.flatMap((e) => (e.kind === "stock" ? [{ sym: e.yahoo, exch: e.exch ?? "NASDAQ" }] : [])),
        );
        for (const e of WATCHLIST) {
          if (e.kind === "stock") this.applyQuote(e, (tv as Map<string, RawQuote>).get(e.yahoo), changed, now);
        }
        this.logger.warn("yahoo 失败,TradingView 补位");
      } catch (tvErr) {
        this.onSourceError("tradingview", tvErr, now);
      }
    }
    if (cRes.status === "fulfilled" && cRes.value) {
      this.cgBackoffUntil = 0;
      this.cgNextBackoff = BACKOFF_BASE_MS;
      for (const e of WATCHLIST) {
        if (e.kind === "crypto") this.applyQuote(e, (cRes.value as Map<string, RawQuote>).get(e.cg), changed, now);
      }
    } else if (cRes.status === "rejected") {
      this.onSourceError("coingecko", cRes.reason, now);
    }

    if (changed.length > 0) {
      this.events$.next({ type: "tick", at: iso(), quotes: changed });
    }
  }

  private onSourceError(source: string, err: unknown, now: number): void {
    if (err instanceof RateLimitedError && (source === "yahoo" || source === "coingecko")) {
      const wait = source === "yahoo" ? this.yahooNextBackoff : this.cgNextBackoff;
      if (source === "yahoo") {
        this.yahooBackoffUntil = now + wait;
        this.yahooNextBackoff = Math.min(wait * 2, BACKOFF_MAX_MS);
      } else {
        this.cgBackoffUntil = now + wait;
        this.cgNextBackoff = Math.min(wait * 2, BACKOFF_MAX_MS);
      }
      this.logger.warn(`${source} 429,退避 ${Math.round(wait / 60_000)}min`);
    } else {
      // 普通失败:冻结旧值,下一轮再试(tradingview 是备胎,不占退避状态)
      this.logger.warn(`${source} fetch failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  private applyQuote(e: WatchEntry, raw: RawQuote | undefined, changed: TickQuote[], now: number): void {
    if (!raw || !Number.isFinite(raw.price) || raw.price <= 0) return;

    let st = this.state.get(e.id);
    if (!st) {
      st = { price: raw.price, prevClose: raw.prevClose, dayPct: raw.dayPct, marketTime: raw.marketTime, hist: [] };
      this.state.set(e.id, st);
      // 无盘中序列的源(加密/TradingView 备胎)用昨收作起点,sparkline 一开始就带当日方向
      const seed = raw.series.length > 0 ? [] : [raw.prevClose];
      st.hist = [...seed, raw.price];
    }

    const moved = raw.price !== st.price;
    st.price = raw.price;
    st.prevClose = raw.prevClose;
    st.dayPct = raw.dayPct;
    st.marketTime = raw.marketTime;

    if (raw.series.length > 0) {
      // 美股:整窗刷新当日 5m 序列(天然去重),末点补最新价
      st.hist = [...raw.series.slice(-(HIST_MAX - 1)), raw.price];
    } else if (moved) {
      st.hist.push(raw.price);
      if (st.hist.length > HIST_MAX) st.hist.shift();
    }

    if (moved) changed.push({ id: e.id, price: st.price });

    if (!this.hasData) {
      this.hasData = true;
      this.successResolve();
    }
  }

  // 轮播导演:按 watchlist 顺序每轮报下一个"已有数据"的标的的最新值
  private scheduleRotation(delay: number): void {
    this.rotateTimer = setTimeout(() => {
      this.rotate();
      this.scheduleRotation(ROTATE_MIN_MS + Math.random() * ROTATE_JITTER_MS);
    }, delay);
  }

  private rotate(): void {
    const ready = WATCHLIST.filter((e) => this.state.has(e.id));
    if (ready.length === 0) return; // 一条数据都还没有,跳过本轮
    const e = ready[this.rotateIdx % ready.length];
    this.rotateIdx = (this.rotateIdx + 1) % ready.length;
    const st = this.state.get(e.id);
    if (!st) return;

    this.events$.next({
      type: "alert",
      at: iso(),
      alert: {
        key: ++this.seq,
        sym: e.id,
        name: e.name,
        price: st.price,
        dayPct: st.dayPct,
        kind: e.kind,
        up: st.dayPct >= 0,
        hist: [...st.hist],
        at: iso(),
      },
    });
  }
}
