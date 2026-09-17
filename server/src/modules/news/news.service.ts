// 加密快讯:CoinDesk + Cointelegraph(RSS)+ 深潮快讯(JSON API,按 web3 过滤)
// → AI 编选 20 条电讯,每 4 小时一轮(NEWS_CRON)。
// AI 供应商优先级:硅基流动(SILICON_API_KEY)→ DeepSeek 官方(DEEPSEEK_API_KEY)。
// 两路 RSS 需代理,默认走本地 NEWS_PROXY_URL(置空禁用);深潮国内直连不走代理。
// RSS 条目只有标题和部分摘要:电讯正文由 AI 在"只许压缩、禁编造数字"
// 约束下合成;配了 key 后报纸卡只出 AI 稿,编选失败沿用上一轮,
// 从未成功过才回退原始标题(无 key 模式恒为原始标题)。
// (弃源记录:MarketWatch MarketPulse 2025 年停更成僵尸源;
//  CryptoCompare news API 已强制 key;CNBC Markets 专题 RSS 返回空;
//  WSJ Markets、CNBC Economy 2026-09 随行情源连环 429 缩编退订,只留加密。)

import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";
import { t } from "../../i18n";
import type { NewsFlashDto, NewsTodayResponse } from "./dto";

const FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
] as const;

// 深潮 7×24 快讯开放 JSON API(TG 频道同源),国内直连;内容横跨
// web3/美股/AI,按 content_categories 含 web3 收窄到加密面。
const TECHFLOW_API = "https://www.techflowpost.com/api/client/newsflashes";
const TECHFLOW_PAGE_SIZE = 50;

interface TechflowFlash {
  id: number;
  title: string;
  abstract: string | null;
  url: string | null;
  is_pr: boolean | null;
  is_visible: boolean | null;
  content_categories: string[] | null;
  created_at: string | null;
}

const ITEMS_PER_FEED = 12;
const FETCH_TIMEOUT_MS = 15_000;
// 置空字符串 = 不走代理(部署在网络 unrestricted 的环境时用)
const PROXY_URL = process.env.NEWS_PROXY_URL ?? "http://127.0.0.1:7897";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

// 硅基流动 V3.2 编选 10 条双语电讯实测 80-100s(含推理);20 条版
// 输出翻倍,超时上限放宽到 7 分钟。max_tokens 显式给满 8k,否则
// 供应商默认 4k 会把 20 条的 JSON 拦腰截断。
const AI_TIMEOUT_MS = 420_000;
const AI_MAX_TOKENS = 8192;
const AI_COUNT = 20;

// AI 供应商优先级:硅基流动(OpenAI 兼容,模型固定 deepseek-ai/DeepSeek-V3.2)
// → DeepSeek 官方(模型可经 NEWS_AI_MODEL 覆盖)。两者都缺省时退回原始标题。
type AiProvider = { name: string; key: string; base: string; model: string };

function resolveAiProvider(): AiProvider | null {
  if (process.env.SILICON_API_KEY) {
    return {
      name: "siliconflow",
      key: process.env.SILICON_API_KEY,
      base: "https://api.siliconflow.cn/v1",
      model: "deepseek-ai/DeepSeek-V3.2",
    };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      name: "deepseek",
      key: process.env.DEEPSEEK_API_KEY,
      base: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: process.env.NEWS_AI_MODEL ?? "deepseek-chat",
    };
  }
  return null;
}

// 只许压缩合并、不许编造;金融场景下数字是命根子,prompt 里单独强调
const AI_SYSTEM_PROMPT = `You are the wire editor of a compact bilingual crypto daily. You receive raw headlines as a numbered list, each formatted as: [source] title — summary (url: ...).

Select the 20 most market-moving crypto stories (prices, ETFs, regulation, hacks, macro events that move crypto); skip general AI, stock or politics coverage unless it directly moves crypto markets; merge duplicates of the same story across sources — the same wire often arrives in English and Chinese, always merge those (keep the best url). Write each as a wire brief in BOTH English and Chinese:
- "headline": a newspaper headline in ALL CAPS, 4-9 words, no ending period
- "headlineZh": the same headline in Chinese, 10-20 characters, no ending punctuation, financial-newspaper tone (e.g. "比特币现货ETF单日净流入破10亿美元")
- "kicker": 2-6 word tag in uppercase, " · " between — assets, tickers or themes, e.g. "BTC · SPOT ETF", "ETH · L2", "SEC · ENFORCEMENT"
- "text": ONE English paragraph of 2-3 sentences, aiming 40-80 words: what moved, the key number, why it matters. Use ALL the facts the input offers — a brief that drops available numbers or context is a defect. Compress only — never invent prices, numbers, names or facts beyond the input; if the material is genuinely thin, write as much as it supports rather than padding.
- "textZh": the same paragraph in Chinese — 60-120 characters, 2-3 sentences, same numbers; Simplified Chinese
- "analysis": an editorial take in Chinese only — 2-3 sentences interpreting the story: why it moves markets, who benefits or loses, what to watch next. Reasoning IS allowed here, but no NEW factual claims: no numbers, names or events beyond the input; mark speculation with 可能/预计/需关注.
- "wires": copy the source name(s), e.g. ["CoinDesk", "深潮"]
- "url": copy one url exactly from the input items you merged, or null if none

Order by market impact, most important first. Reply with valid JSON only: {"flashes": [ ... ]} with at most 20 items.`;

interface FeedItem {
  source: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
}

@Injectable()
export class NewsService implements OnModuleInit {
  private readonly logger = new Logger(NewsService.name);
  private readonly agent: Dispatcher | undefined = PROXY_URL
    ? new ProxyAgent(PROXY_URL)
    : undefined;
  private flashes: NewsFlashDto[] = [];
  private fetchedAt: string | null = null;
  private inflight: Promise<void> | null = null;

  // 每 4 小时一轮(decorator 在模块加载期读 env,进程启动时已就绪)。
  // 深潮每轮只取最新一屏,AI 编选一轮 3-4 分钟,4 小时粒度在新鲜度与
  // API 调用量之间取了保守值;要更勤改 NEWS_CRON 即可。
  // 开机另有 onModuleInit 补抓,重启不吃空窗。
  @Cron(process.env.NEWS_CRON ?? "0 */4 * * *")
  scheduledEdition() {
    void this.refresh();
  }

  onModuleInit() {
    void this.refresh();
  }

  /** 空缓存(首次请求赶在开机补抓完成前)时同步等一轮;全空则 503,前端回退本地假新闻 */
  async getToday(): Promise<NewsTodayResponse> {
    if (!this.fetchedAt) await this.refresh();
    if (!this.fetchedAt) {
      throw new ServiceUnavailableException(t("news.sourceUnavailable"));
    }
    return { at: this.fetchedAt, flashes: this.flashes };
  }

  async refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doRefresh().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async doRefresh(): Promise<void> {
    // 三路并发:两路 RSS(走代理)+ 深潮 JSON(直连)
    const tasks = [
      ...FEEDS.map((f) => ({ name: f.name, run: () => this.fetchFeed(f) })),
      { name: "深潮", run: () => this.fetchTechflow() },
    ];
    const results = await Promise.allSettled(tasks.map((t) => this.retry3s(t.run)));
    const items: FeedItem[] = [];
    let failed = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") items.push(...r.value);
      else {
        failed++;
        this.logger.warn(
          `${tasks[i].name} 抓取失败:${r.reason instanceof Error ? r.reason.message : r.reason}`,
        );
      }
    });
    if (items.length === 0) return; // 全失败:保留上一轮缓存与 fetchedAt
    if (resolveAiProvider()) {
      // 配了 key = 报纸卡只出 AI 编选稿:编选失败沿用上一轮(可能为空,前端
      // 回退 2000 年旧闻),不落回原始标题
      const curated = await this.curate(items);
      if (curated) {
        this.flashes = curated;
        this.fetchedAt = new Date().toISOString();
      }
    } else {
      this.flashes = items.map((it) => ({
        section: "CRYPTO",
        day: new Date().toISOString().slice(0, 10),
        headline: null,
        headlineZh: null,
        kicker: "",
        text: it.summary ? `${it.title} — ${it.summary}` : it.title,
        textZh: null,
        analysis: null,
        url: it.url,
        wires: [it.source],
      }));
      this.fetchedAt = new Date().toISOString();
    }
    if (failed > 0) this.logger.warn(`本轮 ${failed}/${tasks.length} 路源失败`);
  }

  // ── AI 编选(硅基流动优先,OpenAI 兼容)──────────────────────────
  // 输入当轮全部标题,输出按市场影响排序的 20 条电讯:跨源去重(深潮常与
  // 英文源同一事件的中译,已特别要求合并)、压缩合成
  // 1-3 句、kicker 归一到 ticker/主题。URL 要在输入集合里验一道,防幻觉链接。

  private async curate(items: FeedItem[]): Promise<NewsFlashDto[] | null> {
    const ai = resolveAiProvider();
    if (!ai) return null;

    const numbered = items
      .map(
        (it, i) =>
          `${i + 1}. [${it.source}] ${it.title}` +
          (it.summary ? ` — ${it.summary}` : "") +
          ` (url: ${it.url})`,
      )
      .join("\n");

    let json: string;
    try {
      // AI 调用直连:硅基流动与 DeepSeek 官方均为国内可达,不走 RSS 代理
      // (代理链路的抖动与超时不该拖垮编选)
      const res = await undiciFetch(`${ai.base}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${ai.key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: ai.model,
          temperature: 0.3,
          max_tokens: AI_MAX_TOKENS,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: `Date: ${new Date().toISOString().slice(0, 10)}\n\n${numbered}` },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`AI 编选 HTTP ${res.status}:${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      json = body.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      this.logger.warn(`AI 编选调用失败:${err instanceof Error ? err.message : err}`);
      return null;
    }
    const day = new Date().toISOString().slice(0, 10);
    const curated = parseAiFlashes(json, day, new Set(items.map((it) => it.url)));
    if (curated.length === 0) {
      this.logger.warn("AI 编选解析为空,沿用上一轮");
      return null;
    }
    this.logger.log(`AI 编选完成(${ai.name}):${items.length} 条原始 → ${curated.length} 条电讯`);
    return curated;
  }

  /** 瞬时网络抖动单次重试(3s 后);两轮抓取隔 4 小时,一次抖动不值一版报纸 */
  private async retry3s<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (first) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        return await run();
      } catch {
        throw first;
      }
    }
  }

  // 深潮直连不走代理;阿里 WAF 偶发吐 HTML 时 res.json() 抛错,按抓取失败
  // 走重试。带 referer 更像正常浏览器,降低触发风控的概率。
  private async fetchTechflow(): Promise<FeedItem[]> {
    const res = await undiciFetch(`${TECHFLOW_API}?page=1&page_size=${TECHFLOW_PAGE_SIZE}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "zh-CN",
        referer: "https://www.techflowpost.com/zh-CN/newsletter",
        "user-agent": UA,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: TechflowFlash[] };
    return (body.data ?? [])
      .filter((it) => it.title && it.is_visible !== false && !it.is_pr)
      // 深潮横跨 web3/美股/AI,只留 web3 分类,契合纯加密订阅面
      .filter((it) => (it.content_categories ?? []).includes("web3"))
      .map((it) => ({
        source: "深潮",
        title: it.title,
        summary: it.abstract ?? "",
        // 外链缺失时退官网快讯页;两条都在输入集合里,防幻觉校验不受影响
        url: it.url || `https://www.techflowpost.com/zh-CN/newsletter/${it.id}`,
        publishedAt: parseDate(it.created_at),
      }))
      .sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt))
      .slice(0, ITEMS_PER_FEED);
  }

  private async fetchFeed(feed: (typeof FEEDS)[number]): Promise<FeedItem[]> {
    const res = await undiciFetch(feed.url, {
      dispatcher: this.agent,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseRssItems(xml)
      .filter((it) => it.title && it.link)
      .map((it) => ({
        source: feed.name,
        title: it.title as string,
        summary: it.description ?? "",
        url: it.link as string,
        publishedAt: parseDate(it.pubDate),
      }))
      .sort((a, b) => dateMs(b.publishedAt) - dateMs(a.publishedAt))
      .slice(0, ITEMS_PER_FEED);
  }
}

// ── RSS 2.0 最小解析 ────────────────────────────────────────────────
// 只服务固定几个源,只取 item 的 title/link/pubDate/description;
// 不引 XML 依赖,CDATA 与常见实体手工解码足够。

interface RssItem {
  title: string | null;
  link: string | null;
  pubDate: string | null;
  description: string | null;
}

export function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    items.push({
      title: pick(block, "title"),
      link: pick(block, "link"),
      pubDate: pick(block, "pubDate"),
      description: stripHtml(pick(block, "description")),
    });
  }
  return items;
}

function pick(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  const raw = m[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return decodeXml(cdata ? cdata[1].trim() : raw);
}

// 描述字段常混内联 HTML,剥标签后与标题同场喂给 AI
function stripHtml(s: string | null): string | null {
  return decodeXml(s)?.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim() ?? null;
}

function decodeXml(s: string | null): string | null {
  if (s === null) return null;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function dateMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/** 从截断的响应里抠出 flashes 数组中已配平完整的对象(跳过字符串内的花括号) */
function salvageFlashes(s: string): unknown[] | null {
  const m = s.match(/"flashes"\s*:\s*\[/);
  if (!m || m.index === undefined) return null;
  const body = s.slice(m.index + m[0].length);
  const out: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(body.slice(start, i + 1)));
        } catch {
          // 单个对象仍解析不动就丢弃,继续抢救后面的
        }
        start = -1;
      } else if (depth < 0) break; // flashes 数组已闭合
    }
  }
  return out;
}

// ── AI 编选结果解析 ────────────────────────────────────────────────
// 字段级校验:section 不再问 AI(源全是加密,恒 CRYPTO);幻觉 URL(不在
// 输入集合里)置 null;json_object 模式理论上不带围栏,防御性剥一层 ```json```。
// 20 条输出逼近 max_tokens 上限:整体解析失败时按括号配平抢救已完整的
// 电讯对象(烂尾的最后 1-2 条丢弃),不让一次截断毁掉整版。

export function parseAiFlashes(
  content: string,
  day: string,
  knownUrls: Set<string>,
): NewsFlashDto[] {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let arr: unknown[] | null = null;
  try {
    const parsed = JSON.parse(stripped) as { flashes?: unknown };
    if (Array.isArray(parsed.flashes)) arr = parsed.flashes;
  } catch {
    arr = salvageFlashes(stripped);
  }
  if (!arr) return [];
  const out: NewsFlashDto[] = [];
  for (const item of arr) {
    const f = item as Record<string, unknown>;
    const text = typeof f.text === "string" ? f.text.trim() : "";
    if (!text) continue;
    const headline =
      typeof f.headline === "string" && f.headline.trim().length > 0
        ? f.headline.trim().toUpperCase()
        : null;
    const headlineZh =
      typeof f.headlineZh === "string" && f.headlineZh.trim().length > 0
        ? f.headlineZh.trim()
        : null;
    const textZh = typeof f.textZh === "string" && f.textZh.trim().length > 0 ? f.textZh.trim() : "";
    const analysis =
      typeof f.analysis === "string" && f.analysis.trim().length > 0 ? f.analysis.trim() : null;
    const section = "CRYPTO"; // 订阅面已收缩到纯加密源,版面不再分股票/宏观
    const kicker = typeof f.kicker === "string" ? f.kicker.trim() : "";
    const wires = Array.isArray(f.wires)
      ? f.wires.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      : [];
    const url = typeof f.url === "string" && f.url.startsWith("http") && knownUrls.has(f.url)
      ? f.url
      : null;
    out.push({ section, day, headline, headlineZh, kicker, text, textZh: textZh || null, analysis, url, wires });
  }
  return out.slice(0, AI_COUNT);
}
