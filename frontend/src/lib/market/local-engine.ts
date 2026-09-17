// Offline fake market engine — the random-walk theatre that used to live inline in
// MarketAlerts.tsx, extracted verbatim. Runs only when the backend is unreachable
// (or in open-source offline builds): numbers are fabricated on purpose, while the
// payload shape matches the real feed (lib/api/types.ts) so the component can't
// tell the difference.

import type { AlertPayload, Quote } from "@/lib/api/types";
import { SYMS, symName, type Sym } from "./syms";
import { currentLanguage, currentT } from "../i18n/dict";

const HIST_MAX = 30;

type Engine = Record<string, { price: number; hist: number[] }>;

function makeEngine(): Engine {
  const e: Engine = {};
  for (const s of SYMS) e[s.id] = { price: s.base, hist: [s.base] };
  return e;
}

function fmt(s: Sym, v: number) {
  return (
    "$" +
    v.toLocaleString("en-US", { minimumFractionDigits: s.dec, maximumFractionDigits: s.dec })
  );
}

export interface LocalEngine {
  /** One 2 s heartbeat of the random walk (mean-reverting toward base). */
  walk(): void;
  /** Force one crafted move and return it as an alert payload. */
  nextAlert(): AlertPayload;
  /** Full quote table (the market window's offline data source). */
  quotes(): Quote[];
}

export function createLocalEngine(lastId: { current: string | null }): LocalEngine {
  const engine = makeEngine();
  let seq = 0;

  const walk = () => {
    for (const s of SYMS) {
      const c = engine[s.id];
      c.price = c.price * (1 + (Math.random() * 2 - 1) * s.vol) + (s.base - c.price) * 0.01;
      c.hist.push(c.price);
      if (c.hist.length > HIST_MAX) c.hist.shift();
    }
  };

  // The director: each round picks one symbol and forces a decent move. A natural
  // random walk can't produce 2% in 10 s, so the pacing is orchestrated — but the
  // size, the level, and the percentages are all computed from feed state, pushed
  // into hist immediately, and visible as the jump on the sparkline.
  const nextAlert = (): AlertPayload => {
    let sym = SYMS[Math.floor(Math.random() * SYMS.length)];
    if (sym.id === lastId.current) {
      // Rotate symbols so the previous one doesn't hog the stage.
      sym = SYMS[(SYMS.indexOf(sym) + 1 + Math.floor(Math.random() * (SYMS.length - 1))) % SYMS.length];
    }
    const c = engine[sym.id];
    const winPct = c.hist.length >= 5 ? ((c.price - c.hist[0]) / c.hist[0]) * 100 : 0;

    const isBreak = Math.random() < 0.5;
    const up = Math.random() < 0.52; // slightly more ups — bull-market mood

    let price: number;
    let msg: string;

    if (isBreak) {
      if (up) {
        // Next round-number level; if it's too close, skip one more step — no
        // "broke out by 0.05%".
        let level = (Math.floor(c.price / sym.step) + 1) * sym.step;
        if (level - c.price < sym.step * 0.03) level += sym.step;
        price = level * (1 + 0.0012 + Math.random() * 0.0028);
        const detail = sym.id === "BTC" && Math.random() < 0.12
          ? currentT("local.chainBull")
          : winPct >= 0.6
            ? currentT("local.quickUp").replace("{pct}", winPct.toFixed(1))
            : currentT("local.newHigh");
        msg = currentT("local.breakAbove").replace("{level}", fmt(sym, level)).replace("{detail}", detail);
      } else {
        let level = Math.floor(c.price / sym.step) * sym.step;
        if (level <= 0) level = sym.step;
        if (c.price - level < sym.step * 0.03) level -= sym.step;
        if (level <= 0) level = sym.step;
        price = level * (1 - 0.0012 - Math.random() * 0.0028);
        const detail = winPct <= -0.6
          ? currentT("local.quickDown").replace("{pct}", Math.abs(winPct).toFixed(1))
          : currentT("local.giveback");
        msg = currentT("local.breakBelow").replace("{level}", fmt(sym, level)).replace("{detail}", detail);
      }
    } else {
      const m = sym.kind === "crypto" ? 2.2 + Math.random() * 3.3 : 1.2 + Math.random() * 2;
      price = c.price * (1 + (up ? 1 : -1) * (m / 100));
      msg = sym.id === "TSLA" && !up && Math.random() < 0.2
        ? currentT("local.tesla").replace("{pct}", m.toFixed(1))
        : currentT("local.move")
            .replace("{direction}", currentT(up ? "local.up" : "local.down"))
            .replace("{pct}", m.toFixed(1))
            .replace("{price}", fmt(sym, price));
    }

    // The move enters the feed immediately.
    c.price = price;
    c.hist.push(price);
    if (c.hist.length > HIST_MAX) c.hist.shift();

    lastId.current = sym.id;
    return { key: ++seq, sym: sym.id, name: symName(sym.id, currentLanguage(), sym.name), price, msg, up, hist: [...c.hist], at: new Date().toISOString() };
  };

  // The window's fake day change: current price vs the base anchor.
  const quotes = (): Quote[] =>
    SYMS.map((s) => ({
      id: s.id,
      price: engine[s.id].price,
      hist: [...engine[s.id].hist],
      dayPct: ((engine[s.id].price - s.base) / s.base) * 100,
    }));

  return { walk, nextAlert, quotes };
}
