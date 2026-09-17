"use client";

// QUOTES.EXE — the market window: the selected symbol's day chart on top, the full
// watchlist table below. Opened by clicking an alert toast (openMarketWindow below);
// a fixed window id means reopening focuses the existing window and switches its
// selection to the clicked symbol. Data comes from the market feed singleton — real
// SSE quotes when the backend is live, the local walk otherwise.

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/api/types";
import { useConnection } from "@/lib/api/mode";
import { subscribeMarketQuotes } from "@/lib/market/feed";
import { getSym, symName } from "@/lib/market/syms";
import { MenuBar, StatusBar } from "./windows";
import { ChartIcon, PixelIcon } from "./icons";
import { useDesktop, type DesktopApi } from "./context";
import { useI18n } from "@/lib/i18n/LanguageContext";
import Sparkline from "./Sparkline";
import { currentT } from "@/lib/i18n/dict";

// ── Selection store (module scope): survives window close/reopen and lets the
//    toast button steer a window that's already open. ──
const selListeners = new Set<(sym: string) => void>();
let selected = "BTC";
function selectSym(sym: string): void {
  selected = sym;
  for (const l of selListeners) l(sym);
}

export function openMarketWindow(desktop: DesktopApi, sym?: string): void {
  if (sym) selectSym(sym);
  desktop.openDef({
    id: "market",
    title: currentT("market.title"),
    icon: <PixelIcon sprite={ChartIcon} size={14} />,
    w: 470,
    h: 460,
    x: 320,
    y: 80,
    render: () => <MarketWindow />,
  });
}

function priceDec(id: string, p: number): number {
  const s = getSym(id);
  if (s) return s.dec;
  return p >= 1000 ? 0 : p >= 1 ? 2 : 4;
}

function fmtPrice(q: Quote): string {
  const dec = priceDec(q.id, q.price);
  return "$" + q.price.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtPct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/** The selected symbol's chart: day polyline over a dashed previous-close baseline
 *  (navy). Fixed 96px height, fluid width; non-scaling strokes survive the stretch. */
function DayChart({ hist, up, prevClose }: { hist: number[]; up: boolean; prevClose: number }) {
  const color = up ? "#008000" : "#c02020";
  // The baseline participates in the vertical scale so the day's distance from the
  // previous close is visible even when the intraday range is tiny.
  const all = prevClose > 0 ? [...hist, prevClose] : hist;
  const min = Math.min(...all);
  const span = Math.max(...all) - min || 1;
  const W = 420;
  const H = 96;
  const PAD = 5;
  const x = (i: number) => PAD + (i / Math.max(1, hist.length - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - 2 * PAD);
  const prevY = prevClose > 0 ? y(prevClose) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[96px] w-full" aria-hidden>
      {prevY != null && (
        <line
          x1={0}
          x2={W}
          y1={prevY}
          y2={prevY}
          stroke="#000080"
          strokeOpacity={0.35}
          strokeWidth={1}
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function MarketWindow() {
  const { t, lang } = useI18n();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [sel, setSel] = useState(selected);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const conn = useConnection();

  useEffect(
    () =>
      subscribeMarketQuotes((qs) => {
        setQuotes(qs);
        setUpdatedAt(new Date());
      }),
    [],
  );
  useEffect(() => {
    selListeners.add(setSel);
    return () => {
      selListeners.delete(setSel);
    };
  }, []);

  const selQ = quotes.find((q) => q.id === sel) ?? quotes[0];
  const selUp = selQ ? selQ.dayPct >= 0 : true;
  // prevClose is derivable from price + dayPct; it's also the hist seed's first point.
  const prevClose = selQ && selQ.dayPct !== 0 ? selQ.price / (1 + selQ.dayPct / 100) : (selQ?.price ?? 0);
  const spanLabel = getSym(selQ?.id ?? "")?.kind === "crypto" ? "24h" : t("market.intraday");
  const source = conn.status === "live" ? t("market.live") : conn.status === "probing" ? t("market.probing") : t("market.local");

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-chrome px-[6px] pt-0 pb-[2px] gap-[2px]">
      <MenuBar items={[t("market.symbols"), t("market.view"), t("market.help")]} right="NewBoy · World" />
      {selQ ? (
        <>
          <div className="bg-white bevel-in px-[8px] pt-[6px] pb-[7px] flex flex-col gap-[5px]">
            <div className="flex items-baseline justify-between text-[12px] leading-none">
              <b className="tracking-wide">
                {selQ.id} · {symName(selQ.id, lang)}
                <span className={`ml-[10px] tabular-nums ${selUp ? "text-[#008000]" : "text-[#c02020]"}`}>
                  {fmtPrice(selQ)}
                </span>
              </b>
              <span className={`tabular-nums ${selUp ? "text-[#008000]" : "text-[#c02020]"}`}>
                {spanLabel} {fmtPct(selQ.dayPct)}
              </span>
            </div>
            <DayChart hist={selQ.hist} up={selUp} prevClose={prevClose} />
          </div>
          <div className="flex-1 min-h-0 bg-white bevel-in overflow-auto">
            <table className="w-full text-[11px] leading-[1.3] text-black text-left border-collapse tabular-nums">
              <thead>
                <tr className="bg-chrome sticky top-0">
                  <th className="fm-th">{t("market.code")}</th>
                  <th className="fm-th">{t("market.name")}</th>
                  <th className="fm-th text-right">{t("market.price")}</th>
                  <th className="fm-th text-right">{t("market.change")}</th>
                  <th className="fm-th">{t("market.trend")}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => {
                  const active = q.id === selQ.id;
                  const up = q.dayPct >= 0;
                  return (
                    <tr
                      key={q.id}
                      onClick={() => selectSym(q.id)}
                      className={`cursor-pointer border-b border-[#d4d0c8] ${
                        active ? "bg-navy text-white" : "hover:bg-navy hover:text-white"
                      }`}
                    >
                      <td className="px-[6px] py-[1px] whitespace-nowrap">{q.id}</td>
                      <td className="px-[6px] py-[1px] whitespace-nowrap">{symName(q.id, lang)}</td>
                      <td className="px-[6px] py-[1px] text-right whitespace-nowrap">{fmtPrice(q)}</td>
                      <td
                        className={`px-[6px] py-[1px] text-right whitespace-nowrap ${
                          active ? "" : up ? "text-[#008000]" : "text-[#c02020]"
                        }`}
                      >
                        {fmtPct(q.dayPct)}
                      </td>
                      <td className="px-[4px] py-[1px]">
                        <Sparkline hist={q.hist} up={up} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="flex-1 grid place-items-center text-[12px] text-black/50">{t("market.connecting")}</div>
      )}
      <StatusBar
        left={t("market.source").replace("{source}", source)}
        right={`${t("market.count").replace("{count}", String(quotes.length))}${updatedAt ? t("market.updated").replace("{time}", updatedAt.toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-GB", { hour12: false })) : ""}`}
      />
    </div>
  );
}
