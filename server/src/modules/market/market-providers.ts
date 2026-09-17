// 行情数据源拉取层(纯函数,不进 DI):Yahoo spark(美股批量)+ TradingView
// scanner(美股备胎)+ CoinGecko(加密批量)。
// 全部免 key,2026-09 实测直连可用;网络环境变化时用
// MARKET_PROXY_URL 指到本地代理(news 模块同款用法)。
// 这里不做重试:引擎 30s 一轮地轮询,失败等下一轮即可(news 是 12h 一轮
// 才需要批内重试)。拉取失败时上层冻结旧值,绝不造假数。

import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

// 置空字符串 = 直连
const PROXY_URL = process.env.MARKET_PROXY_URL ?? "";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10_000;

const agent: Dispatcher | undefined = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

/** 各源统一报价形状 */
export interface RawQuote {
  price: number;
  /** 日内(美股)/24h(加密)涨跌幅,provider 直接给出 */
  dayPct: number;
  /** 昨收(美股)或 24h 前价格(加密,由 price 与 dayPct 反推) */
  prevClose: number;
  /** 当日 close 序列(美股 5 分钟级);加密无盘中序列,为 [] */
  series: number[];
  /** 最后真实成交时间(epoch ms);加密无此概念,取拉取时刻 */
  marketTime: number;
}

/** 429/限频专用错误,引擎据此退避,与普通网络失败区别对待 */
export class RateLimitedError extends Error {
  constructor(message = "rate limited") {
    super(message);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  // Retry on network errors only: the first hop through a cold local proxy
  // tunnel to a domain intermittently drops the TLS handshake; a short pause
  // between attempts lets the tunnel warm up. HTTP errors (429/5xx) are not
  // retried here — the engine treats rate limiting separately.
  let res: Awaited<ReturnType<typeof undiciFetch>> | undefined;
  let lastErr: unknown;
  for (const delayMs of [0, 300, 800]) {
    try {
      res = await undiciFetch(url, {
        dispatcher: agent,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": UA, accept: "application/json" },
      });
      break;
    } catch (err) {
      lastErr = err;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  if (!res) throw lastErr;
  if (res.status === 429) throw new RateLimitedError(`HTTP 429 ${new URL(url).host}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${new URL(url).host}`);
  return res.json();
}

// ── 美股:Yahoo v7 spark(免 cookie/crumb,一次拿全部 + 当日 5m 序列) ──
// 非官方接口,字段可能漂移;单标的缺字段只跳过该标的,不炸整批。
// query1/query2 是两套独立前端,单前端限流时下一轮换边重试。

let sparkHost: "query1" | "query2" = "query1";

interface SparkMeta {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
}

export async function fetchYahooSpark(symbols: string[]): Promise<Map<string, RawQuote>> {
  const url =
    `https://${sparkHost}.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.join(","))}` +
    `&range=1d&interval=5m`;
  let body: {
    spark?: { result?: { symbol?: string; response?: { meta?: SparkMeta; indicators?: { quote?: { close?: (number | null)[] }[] } }[] }[] };
  };
  try {
    body = (await fetchJson(url)) as typeof body;
  } catch (err) {
    sparkHost = sparkHost === "query1" ? "query2" : "query1";
    throw err;
  }

  const out = new Map<string, RawQuote>();
  for (const item of body.spark?.result ?? []) {
    const symbol = item.symbol;
    const r = item.response?.[0];
    const meta = r?.meta;
    if (!symbol || !meta || meta.regularMarketPrice == null) continue;
    const price = meta.regularMarketPrice;

    const prevClose = meta.chartPreviousClose ?? meta.previousClose;
    const marketTime = meta.regularMarketTime;
    out.set(symbol, {
      price,
      dayPct: meta.regularMarketChangePercent ?? 0,
      prevClose: prevClose ?? price,
      series: (r?.indicators?.quote?.[0]?.close ?? []).filter((v): v is number => v != null),
      marketTime: marketTime != null ? marketTime * 1000 : Date.now(),
    });
  }
  return out;
}

// ── 美股备胎:TradingView scanner(免 key,一次 POST 批量) ──
// Yahoo 被限流时的自动补位:只有 close/change(15min 延迟),没有盘中
// 序列 —— hist 退化为逐轮累积(同加密)。按交易所前缀匹配,前缀错了
// 会静默丢标的(exch 见 watchlist.ts)。

export async function fetchTradingView(
  symbols: { sym: string; exch: string }[],
): Promise<Map<string, RawQuote>> {
  const res = await undiciFetch("https://scanner.tradingview.com/america/scan", {
    dispatcher: agent,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    method: "POST",
    headers: { "user-agent": UA, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      symbols: { tickers: symbols.map((s) => `${s.exch}:${s.sym}`), query: { types: [] } },
      columns: ["close", "change"],
    }),
  });
  if (res.status === 429) throw new RateLimitedError("HTTP 429 tradingview");
  if (!res.ok) throw new Error(`HTTP ${res.status} tradingview`);
  const body = (await res.json()) as { data?: { s?: string; d?: (number | null)[] }[] };

  const out = new Map<string, RawQuote>();
  for (const row of body.data ?? []) {
    const [close, changePct] = row.d ?? [];
    if (!row.s || close == null) continue;
    const sym = row.s.slice(row.s.indexOf(":") + 1);
    const dayPct = changePct ?? 0;
    out.set(sym, {
      price: close,
      dayPct,
      prevClose: close / (1 + dayPct / 100),
      series: [],
      marketTime: Date.now(),
    });
  }
  return out;
}

// ── 加密货币:CoinGecko simple/price(免 key,一次拿全部 + 24h 涨跌) ──
// keyless 公共限额 ~5-15 req/min,30s 一轮(2 req/min)在安全区内。

export async function fetchCoinGecko(ids: string[]): Promise<Map<string, RawQuote>> {
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}` +
    `&vs_currencies=usd&include_24hr_change=true`;
  const body = (await fetchJson(url)) as Record<string, { usd?: number; usd_24h_change?: number }>;

  const out = new Map<string, RawQuote>();
  for (const [id, r] of Object.entries(body)) {
    if (r.usd == null) continue;
    const dayPct = r.usd_24h_change ?? 0;
    out.set(id, {
      price: r.usd,
      dayPct,
      // 24h 前价格 = 现价 / (1 + 涨跌幅),作为 prevClose 等价物
      prevClose: r.usd / (1 + dayPct / 100),
      series: [],
      marketTime: Date.now(),
    });
  }
  return out;
}
