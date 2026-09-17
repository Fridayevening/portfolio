"use client";

import { useEffect, useRef, useState } from "react";
import { ChartIcon, PixelIcon } from "./icons";
import type { AlertPayload } from "@/lib/api/types";
import { subscribeMarketAlerts } from "@/lib/market/feed";
import { symName, getSym } from "@/lib/market/syms";
import { useDesktop } from "./context";
import { useI18n } from "@/lib/i18n/LanguageContext";
import type { DictKey } from "@/lib/i18n/dict";
import { openMarketWindow } from "./MarketWindow";
import Sparkline from "./Sparkline";

// ── Market alerts ──────────────────────────────────────────
// Toasts come from the market feed (lib/market/feed.ts): a server-side rotation over
// real quotes when the backend is live, the local random-walk theatre when it's not.
// This component only owns push lifecycle + rendering. Clicking the card opens the
// market window (the toast itself lives out its screen time); ✕ dismisses.

/** How long a push stays on screen. */
const VISIBLE_MS = 7800;
/** Exit animation is 380 ms; this adds slack. */
const EXIT_MS = 420;
/** Breathing room before a queued push takes the stage. */
const QUEUE_GAP_MS = 900;
/** Pushes arriving while a toast is up wait here; beyond the cap, oldest dropped. */
const PENDING_MAX = 2;

type ToastState = AlertPayload & { in: boolean };

function formatPrice(id: string, price: number): string {
  const dec = getSym(id)?.dec ?? 2;
  return "$" + price.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Compose the server-rotation toast copy locally; the server sends structured
 *  fields (dayPct/kind) because EventSource can't carry the x-lang header. */
function serverAlertMsg(a: AlertPayload, t: (key: DictKey) => string): string {
  const dayPct = a.dayPct ?? 0;
  const pct = `${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(1)}%`;
  const span = a.kind === "stock" ? t("market.intraday") : t("market.h24");
  return `${t("market.alertNow")} ${formatPrice(a.sym, a.price)} · ${span} ${pct}`;
}

export default function MarketAlerts() {
  const desktop = useDesktop();
  const { t, lang } = useI18n();
  const [toast, setToast] = useState<ToastState | null>(null);
  const pending = useRef<AlertPayload[]>([]);
  const busy = useRef(false);
  // Handle for manual dismissal (click anywhere on the toast or ✕): the lifecycle runs
  // in the effect below; the JSX only holds a stable ref.
  const dismissRef = useRef<(() => void) | null>(null);

  // Push life chain: enter (slide in) → on screen VISIBLE_MS → exit (slide out) →
  // queued push or idle. One strand of timers runs the whole chain; manual dismissal
  // clears the pending ones and jumps straight to the exit.
  useEffect(() => {
    let dead = false;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let raf = 0;
    const step = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers = timers.filter((x) => x !== t);
        if (!dead) fn();
      }, ms);
      timers.push(t);
    };
    const clearPend = () => {
      timers.forEach(clearTimeout);
      timers = [];
      if (raf) cancelAnimationFrame(raf);
    };

    const show = (a: AlertPayload) => {
      busy.current = true;
      setToast({ ...a, in: false });
      raf = requestAnimationFrame(() => {
        if (!dead) setToast((s) => (s && s.key === a.key ? { ...s, in: true } : s));
      });
      step(retire, VISIBLE_MS);
    };

    const retire = () => {
      setToast((s) => (s ? { ...s, in: false } : s));
      step(() => {
        setToast(null);
        busy.current = false;
        if (pending.current.length > 0) step(() => show(pending.current.shift() as AlertPayload), QUEUE_GAP_MS);
      }, EXIT_MS);
    };

    const unsubscribe = subscribeMarketAlerts((a) => {
      if (dead) return;
      if (busy.current) pending.current = [...pending.current, a].slice(-PENDING_MAX);
      else show(a);
    });

    dismissRef.current = () => {
      clearPend();
      retire();
    };

    return () => {
      dead = true;
      clearPend();
      unsubscribe();
      dismissRef.current = null;
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute bottom-[50px] left-2 z-[72] flex flex-col-reverse gap-[6px]"
      role="status"
      aria-live="polite"
    >
      {toast && (
        <div
          key={toast.key}
          title={t("market.clickToOpen")}
          onClick={() => openMarketWindow(desktop, toast.sym)}
          className="pointer-events-auto w-[268px] cursor-pointer bg-chrome p-[2px] shadow-[inset_-1px_-1px_#0a0a0a,inset_1px_1px_#fff,inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf,3px_4px_10px_rgba(0,0,0,.4)]"
          style={{
            opacity: toast.in ? 1 : 0,
            transform: toast.in ? "none" : "translateX(-24px)",
            transition: "opacity .3s, transform .38s cubic-bezier(.2,1.2,.4,1)",
          }}
        >
          <div className="titlebar-active flex h-[17px] items-center gap-[5px] px-[4px] text-[10.5px] font-bold text-white">
            <PixelIcon sprite={ChartIcon} size={13} className="shrink-0" />
            <span className="leading-none">{t("market.alertTitle")}</span>
            <button
              type="button"
              aria-label={t("market.dismiss")}
              className="alert-x ml-auto px-[3px] text-[9px] font-normal leading-none"
              onClick={(e) => {
                e.stopPropagation();
                dismissRef.current?.();
              }}
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-[8px] px-[8px] py-[7px]">
            <Sparkline hist={toast.hist} up={toast.up} />
            <div className="min-w-0">
              <b className="block text-[11.5px] leading-tight">
                {toast.sym} · {symName(toast.sym, lang, toast.name)}
              </b>
              <span className="block max-w-[200px] truncate text-[10px] leading-tight text-[#555]">
                {toast.msg ?? serverAlertMsg(toast, t)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
