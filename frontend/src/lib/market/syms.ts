// Symbol table for the OFFLINE fake engine only — ids/names/kinds are hand-aligned
// with newboy-server/src/modules/market/watchlist.ts; base/vol/dec/step never leave
// this client and don't need to stay in sync with anything real. base is a rough
// anchor (the walk mean-reverts toward it), so approximate values are fine.

export interface Sym {
  id: string;
  name: string;
  nameEn: string;
  kind: "stock" | "crypto";
  /** Mean-reversion anchor price (approximate). */
  base: number;
  /** Per-tick volatility (± fraction). */
  vol: number;
  /** Decimals shown. */
  dec: number;
  /** Round-number level step (the psychological break/breakdown thresholds). */
  step: number;
}

export const SYMS: Sym[] = [
  // Stock tickers are tracked via xStocks tokens on the server (CoinGecko);
  // kind stays "crypto" here to mirror the server watchlist. base/vol remain
  // rough anchors for the offline walk only.
  { id: "AAPL", name: "苹果", nameEn: "Apple", kind: "crypto", base: 326, vol: 0.0007, dec: 2, step: 5 },
  { id: "MSFT", name: "微软", nameEn: "Microsoft", kind: "crypto", base: 512, vol: 0.0007, dec: 2, step: 10 },
  { id: "GOOGL", name: "谷歌", nameEn: "Google", kind: "crypto", base: 315, vol: 0.0008, dec: 2, step: 5 },
  { id: "AMZN", name: "亚马逊", nameEn: "Amazon", kind: "crypto", base: 252, vol: 0.0011, dec: 2, step: 5 },
  { id: "NVDA", name: "英伟达", nameEn: "Nvidia", kind: "crypto", base: 182, vol: 0.0013, dec: 2, step: 5 },
  { id: "META", name: "Meta", nameEn: "Meta", kind: "crypto", base: 643, vol: 0.0012, dec: 2, step: 10 },
  { id: "TSLA", name: "特斯拉", nameEn: "Tesla", kind: "crypto", base: 411, vol: 0.0019, dec: 2, step: 10 },
  { id: "HOOD", name: "罗宾汉", nameEn: "Robinhood", kind: "crypto", base: 160, vol: 0.002, dec: 2, step: 5 },
  { id: "CRCL", name: "Circle", nameEn: "Circle", kind: "crypto", base: 110, vol: 0.0024, dec: 2, step: 5 },
  { id: "BTC", name: "比特币", nameEn: "Bitcoin", kind: "crypto", base: 77080, vol: 0.0016, dec: 0, step: 1000 },
  { id: "ETH", name: "以太坊", nameEn: "Ethereum", kind: "crypto", base: 2467, vol: 0.0018, dec: 0, step: 100 },
  { id: "SOL", name: "Solana", nameEn: "Solana", kind: "crypto", base: 99.5, vol: 0.0024, dec: 2, step: 5 },
  { id: "HYPE", name: "Hyperliquid", nameEn: "Hyperliquid", kind: "crypto", base: 79.4, vol: 0.0028, dec: 2, step: 1 },
  { id: "ZAMA", name: "Zama", nameEn: "Zama", kind: "crypto", base: 0.0465, vol: 0.003, dec: 4, step: 0.001 },
  { id: "UNI", name: "Uniswap", nameEn: "Uniswap", kind: "crypto", base: 6.01, vol: 0.0026, dec: 3, step: 0.1 },
  { id: "AAVE", name: "Aave", nameEn: "Aave", kind: "crypto", base: 122.3, vol: 0.0025, dec: 2, step: 5 },
];

export function getSym(id: string): Sym | undefined {
  return SYMS.find((s) => s.id === id);
}

/** Display name for an alert: payload name (server watchlist may know symbols we
 *  don't) → local table → the raw ticker. */
export function symLabel(id: string, fallback?: string): string {
  return fallback ?? getSym(id)?.name ?? id;
}

/** Lang-aware display name: local `name` (zh) / `nameEn` (en) → server payload
 *  name → the raw ticker. */
export function symName(id: string, lang: "zh" | "en", fallback?: string): string {
  const s = getSym(id);
  if (s) return lang === "en" ? s.nameEn : s.name;
  return fallback ?? id;
}
