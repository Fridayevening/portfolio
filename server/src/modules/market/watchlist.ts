// 行情关注列表 —— 想加减标的,改这个文件就够了。
// 当前全走 CoinGecko 免 key(cg = coin id,https://www.coingecko.com 搜币种,
// URL 末段即 id)。美股用 xStocks 链上版(id 形如 <公司>-xstock):24/7 交易,
// 报的是代币价——美股开盘时套利贴合股价,闭市/周末会漂移,轮播涨跌恒为 24h 口径。
// yahoo/TradingView 股价路径仍在引擎里:加回 kind:"stock" 条目即自动启用
// (yahoo 带 5m 盘中序列;exch 是 TradingView 备胎的交易所前缀)。
// 本表与前端 newboy/src/lib/market/syms.ts 手写对齐(只对齐 id/name/kind,
// 前端 base/vol 仅供其离线假引擎用,数值不必同步)。
// 播报方式是轮播:引擎按本表顺序每 ~12s 报下一个标的的最新拉取值。
// (退订记录:SPCX/星链 2026-09 随链上化移除——SpaceX 未上市,链上版无成交价。)

export type WatchEntry =
  /** exch:TradingView 备胎按交易所前缀匹配标的,缺省 NASDAQ */
  | { id: string; name: string; kind: "stock"; yahoo: string; exch?: "NASDAQ" | "NYSE" }
  | { id: string; name: string; kind: "crypto"; cg: string };

export const WATCHLIST: readonly WatchEntry[] = [
  // ── 链上股票(xStocks 代币价)──
  { id: "AAPL", name: "苹果", kind: "crypto", cg: "apple-xstock" },
  { id: "MSFT", name: "微软", kind: "crypto", cg: "microsoft-xstock" },
  { id: "GOOGL", name: "谷歌", kind: "crypto", cg: "alphabet-xstock" },
  { id: "AMZN", name: "亚马逊", kind: "crypto", cg: "amazon-xstock" },
  { id: "NVDA", name: "英伟达", kind: "crypto", cg: "nvidia-xstock" },
  { id: "META", name: "Meta", kind: "crypto", cg: "meta-xstock" },
  { id: "TSLA", name: "特斯拉", kind: "crypto", cg: "tesla-xstock" },
  { id: "HOOD", name: "罗宾汉", kind: "crypto", cg: "robinhood-xstock" },
  { id: "CRCL", name: "Circle", kind: "crypto", cg: "circle-xstock" },
  // ── 加密货币 ──
  { id: "BTC", name: "比特币", kind: "crypto", cg: "bitcoin" },
  { id: "ETH", name: "以太坊", kind: "crypto", cg: "ethereum" },
  { id: "SOL", name: "Solana", kind: "crypto", cg: "solana" },
  { id: "HYPE", name: "Hyperliquid", kind: "crypto", cg: "hyperliquid" },
  { id: "ZAMA", name: "Zama", kind: "crypto", cg: "zama" },
  { id: "UNI", name: "Uniswap", kind: "crypto", cg: "uniswap" },
  { id: "AAVE", name: "Aave", kind: "crypto", cg: "aave" },
];

/** 显示小数位按价格量级推导:BTC→0,股票/SOL→2,<$1 的 meme→4 */
export function decFor(p: number): number {
  return p >= 1000 ? 0 : p >= 1 ? 2 : 4;
}
