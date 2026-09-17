// 市场行情契约类型 —— 与前端 newboy/src/lib/api/types.ts 手写对齐(docs/02 §3)。
// 接口超过 ~8 个或对齐返工 3 次即切 @nestjs/swagger 生成。

export type SymKind = "stock" | "crypto";

/** 标的定义(基准价/波动率/关口步长)。只活在两侧各自的代码里,不上线。 */
export interface Sym {
  id: string;
  name: string;
  kind: SymKind;
  /** 基准价,均值回归的锚 */
  base: number;
  /** 单跳波动率(±比例) */
  vol: number;
  /** 显示小数位 */
  dec: number;
  /** 整数关口步长(突破/跌破的心理价位) */
  step: number;
}

/** 全量报价(快照用,带走势窗口与日内涨跌) */
export interface Quote {
  id: string;
  price: number;
  hist: number[];
  /** 日内(美股)/24h(加密)涨跌幅 */
  dayPct: number;
}

/** 增量报价(tick 用,走势窗口跟快照/alert 拿,别每 2s 重发 30 个数) */
export interface TickQuote {
  id: string;
  price: number;
}

export interface QuotesResponse {
  at: string;
  quotes: Quote[];
}

export interface AlertPayload {
  key: number;
  /** 标的 id,客户端用本地标的表解析展示名 */
  sym: string;
  /** 展示名兜底:服务端 watchlist 新增了客户端不认识的标的时用它 */
  name?: string;
  price: number;
  /** 日内(美股)/24h(加密)涨跌幅 —— 客户端据此拼本地语言的播报文案 */
  dayPct?: number;
  /** 标的类别,决定播报用"日内"还是"24h" */
  kind?: SymKind;
  /** 预格式化文案(离线镜像引擎提供;服务端不再生成,交给客户端本地化) */
  msg?: string;
  up: boolean;
  hist: number[];
  at: string;
}

export type StreamEvent =
  | { type: "snapshot"; at: string; quotes: Quote[] }
  | { type: "tick"; at: string; quotes: TickQuote[] }
  | { type: "alert"; at: string; alert: AlertPayload };
