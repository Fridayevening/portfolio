"use client";

// Old News card — the bottom-right desk news gadget, Y2K-portal style: electric
// blue gradient masthead, pill section chip, blinking LIVE badge. Chinese by
// default; the English copy rides along in the API response, unrendered.
// Clicking the headline opens the full page as a REAL desktop window (via
// openDef — drag / taskbar / focus, non-modal, the desk stays usable) with
// prev/next cycling through the day's briefs; the outbound wire link lives in
// that window, off the headline. Offline or server-down keeps the year-2000
// back catalog, so the desktop stays fully functional without the backend
// (see lib/api/client.ts).

import { useCallback, useEffect, useRef, useState } from "react";
import { getNewsToday } from "@/lib/api/news";
import type { NewsTodayResponse } from "@/lib/api/types";
import { useDesktop } from "./context";
import { ChartIcon, PixelIcon } from "./icons";
import { useI18n } from "../../lib/i18n/LanguageContext";
import type { Lang } from "../../lib/i18n/dict";

type Edition = {
  section: string;
  sectionZh?: string;
  date: string;
  headline: string;
  deck: string;
  body?: string;
  /** Editorial take — detail window only, never on the card. */
  analysis?: string;
  index?: string[];
  url?: string;
  classified: string;
};

const EDITIONS: Edition[] = [
  {
    section: "Energy",
    sectionZh: "能源",
    date: "2000.03.08 · WED",
    headline: "OIL PRICES SOAR, WORLD INTERVENES",
    deck: "London and New York crude hit $31 and $34 a barrel, highest since the 1991 Gulf War.",
    body: "After nearly a year of gains, crude broke through OPEC's ceiling in London and New York yesterday, hitting $31 and $34 a barrel. Washington tapped 30 million barrels of strategic reserve; producers raised output, and by year's end prices began to ease.",
    classified: "FOR SALE: one bicycle. Runs on nothing, ignores oil prices. Best offer.",
  },
  {
    section: "Politics",
    sectionZh: "政局",
    date: "2000.03.27 · MON",
    headline: "PUTIN WINS; RUSSIA VOWS A COMEBACK",
    deck: "Putin wins the early vote, vowing to rebuild a strong Russian state.",
    body: "Acting President Vladimir Putin has won Russia's early presidential election, becoming its third president. Taking office under the banner of reviving Russia, he promises new thinking and new policies — a strong state, and a return to great-power standing.",
    classified: "LOST: great-power status, missing some ten years. Generous reward. — RUSSIA",
  },
  {
    section: "Tech",
    sectionZh: "科技",
    date: "2000.06.27 · TUE",
    headline: "GENOME DRAFT DONE; LIFE YIELDS SECRETS",
    deck: "Six nations finish the ten-year draft human genome, 97% covered.",
    body: "Scientists from the US, Britain, Japan, Germany, France and China unveiled the draft human genome yesterday after ten years' work. It covers 97% of the genome and 85% of the base pairs — a first pass at the human blueprint, and a mighty push for medicine.",
    classified: "WANTED: base pairs, A/T/C/G any order. Pairs preferred. Top prices paid.",
  },
  {
    section: "Summit",
    sectionZh: "峰会",
    date: "2000.09.08 · FRI",
    headline: "MILLENNIUM SUMMIT DRAWS THE WORLD",
    deck: "150+ heads of state adopt the Millennium Declaration.",
    body: "The UN Millennium Summit closed in New York yesterday, drawing 150+ heads of state, among them President Jiang Zemin. The Declaration reaffirmed the UN Charter; at China's initiative, the five permanent members met for the first time.",
    classified: "FOR HIRE: hall seating 150 heads of state, interpretation included. Fridays booked.",
  },
  {
    section: "Markets",
    sectionZh: "市场",
    date: "2000.12.21 · THU",
    headline: "NASDAQ TUMBLES; WORLD MARKETS SHAKE",
    deck: "Nasdaq closes at a year-low 2,332 — under half its March peak.",
    body: "The Nasdaq, barometer of the 'new economy', has never recovered from its mid-April plunge, closing at a year-low 2,332 — over 50% below March's record 5,132. Markets worldwide wobbled, and confidence in internet names has taken a hit.",
    classified: "MEANWHILE — reader Satoshi Nakamoto is defragmenting a 20 GB drive. 14% done.",
  },
];

// Live classifieds keep the gag slot's voice (now dressed as a banner ad)
// while admitting the paper went same-day.
const LIVE_CLASSIFIEDS = [
  "BREAKING: this paper is now current. management apologizes for the inconvenience.",
  "FOR SALE: 26-year backlog of old news, lightly used. Best offer.",
  "WANTED: yesterday's paper. it was better yesterday.",
  "NOTICE: dispatches now arrive twice daily, via cable modem. the paperboy is retraining.",
  "LOST: the year 2000. last seen on this card. no reward.",
  "MEANWHILE — a server somewhere updates this page and takes no lunch break.",
];

// 中文版面名;未知版面直通大写英文兜底
const SECTION_LABEL: Record<string, string> = {
  stocks: "股票",
  crypto: "加密",
  macro: "宏观",
};

const sectionLabel = (s: string) => SECTION_LABEL[s.trim().toLowerCase()] ?? s.toUpperCase();

const SECONDS_PER_EDITION = 13;
// The server cron refreshes morning and evening; a slow client re-poll keeps a
// day-long open desktop from reading a stale morning edition forever.
const REPOLL_MS = 30 * 60_000;

const CARD_H = 320;

// Shared with openDef so title updates via re-openDef never drift the geometry.
const NEWS_WIN = { w: 620, h: 540, x: 330, y: 70 } as const;

/** Split a dispatch into sentences: a sentence ender followed by a capital.
 *  "U.S. and Iran" survives (lowercase continuation); ". A mass exodus" splits.
 *  The second lookbehind stops dotted all-caps abbreviations ("the U.S. Federal
 *  Reserve") from splitting mid-name. Only the raw-headline fallback needs
 *  this; AI items carry separate headline/body fields. */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])(?<![A-Z]\.[A-Z][.!?])\s+(?=[A-Z0-9"“])/);
}

/** Digital masthead date — "2000.09.11 · FRI", the portal-site way. */
function mastheadDate(dayIso: string): string {
  const [y, m, d] = dayIso.split("-").map(Number);
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(y, m - 1, d).getDay()];
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} · ${wd}`;
}

function liveEditions(res: NewsTodayResponse, lang: Lang): Edition[] {
  const flashes = lang === "en"
    ? res.flashes.filter((f) => f.headline !== null || !/[\p{Script=Han}]/u.test(f.text))
    : res.flashes;
  return flashes.map((f, i, all) => {
    // Raw items fall back to first-sentence-as-headline. In English mode, raw
    // Chinese-only wires are filtered above rather than presented untranslated.
    const sentences = splitSentences(f.text);
    const headline = lang === "en" ? f.headline ?? sentences[0] : f.headlineZh ?? f.headline ?? sentences[0];
    const body = lang === "en"
      ? (f.headline ? f.text : sentences.slice(1).join(" ") || undefined)
      : f.textZh ?? (f.headline ? f.text : sentences.slice(1).join(" ") || undefined);
    const kicker = [f.kicker, f.wires.join(" / ")].filter(Boolean).join(" — ");
    return {
      section: f.section.toUpperCase(),
      sectionZh: sectionLabel(f.section),
      date: mastheadDate(f.day),
      headline,
      deck: kicker.length > 0 ? kicker.toUpperCase() : "WIRE DISPATCH",
      body,
      analysis: lang === "zh" ? f.analysis ?? undefined : undefined,
      index: [1, 2, 3].map((k) => {
        const other = all[(i + k) % all.length];
        const otherHeadline = lang === "en"
          ? other.headline ?? splitSentences(other.text)[0]
          : other.headlineZh ?? other.headline ?? splitSentences(other.text)[0];
        return `${lang === "en" ? other.section.toUpperCase() : sectionLabel(other.section)} — ${otherHeadline}`;
      }),
      url: f.url ?? undefined,
      classified: LIVE_CLASSIFIEDS[i % LIVE_CLASSIFIEDS.length],
    };
  });
}

function NewsDetail({
  ed,
  pos,
  total,
  onNav,
}: {
  ed: Edition;
  pos: number;
  total: number;
  onNav: (delta: number) => void;
}) {
  const { t, lang } = useI18n();
  return (
    <div className="flex h-full flex-col bg-[#e9f1fb]">
      <div className="paper-bob min-h-0 flex-1 overflow-auto p-2">
        <div className="ledger-turn border border-[#9db4d6] bg-white shadow-[0_2px_8px_rgba(10,37,64,0.12)]">
          <div className="flex items-end justify-between bg-gradient-to-r from-[#0435c7] to-[#0ea5e9] px-4 pt-[6px] pb-[4px] text-white">
            <span className="shrink-0 text-[10px]">25¢</span>
            <p className="font-display text-[34px] leading-none tracking-[0.04em]">The Daily Prophet</p>
            <span className="shrink-0 text-[10px]">EST. 2000</span>
          </div>
          <div className="px-5 pb-4 pt-2">
            <div className="flex items-center justify-between py-[4px]">
              <span className="bg-[#0435c7] px-[7px] py-[1px] text-[10px] font-bold tracking-[0.14em] text-white">
                {lang === "en" ? ed.section : ed.sectionZh ?? ed.section}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-[#0369a1]">{ed.date}</span>
            </div>
            <h2 className="mt-[12px] text-[27px] font-bold leading-[1.3] text-[#0b1220]">
              {ed.headline}
            </h2>
            <p className="mt-[6px] text-[11px] font-semibold tracking-[0.06em] text-[#0369a1]">
              {ed.deck}
            </p>
            {ed.body && (
              <p className="mt-[12px] border-t border-[#dbe6f5] pt-[10px] text-[15px] leading-[1.95] text-[#1e293b]">
                {ed.body}
              </p>
            )}

            {/* Editorial take — the desk's read on the story, visually a
                callout so it never reads as wire copy. Window only. */}
            {ed.analysis && (
              <div className="mt-[12px] border-l-[3px] border-[#0ea5e9] bg-[#f0f7ff] py-[8px] pl-[10px] pr-[8px]">
                <p className="text-[9px] font-bold tracking-[0.16em] text-[#0369a1]">
                  {t("ledger.analysis")}
                </p>
                <p className="mt-[4px] text-[13px] leading-[1.85] text-[#1e293b]">
                  {ed.analysis}
                </p>
              </div>
            )}

            {/* The outbound wire link lives here, off the headline: a chunky
                millennium-web button, not part of the story. */}
            {ed.url && (
              <a
                href={ed.url}
                target="_blank"
                rel="noreferrer"
                className="press bevel-thin-out mt-[16px] block bg-[#0435c7] px-3 py-[7px] text-center text-[13px] font-bold tracking-[0.06em] text-white hover:bg-[#032a9e]"
              >
                {t("ledger.readWire")}
              </a>
            )}

            <p className="mt-[14px] border border-dashed border-[#9db4d6] bg-[#f0f7ff] px-2 py-[4px] text-center text-[10px] leading-[1.5] text-[#475569]">
              <span className="mr-[4px] align-top font-mono text-[8px] text-[#94a3b8]">[AD]</span>
              {ed.classified}
            </p>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-[#c3d3ea] px-2 py-[4px]">
        <button
          type="button"
          className="press bevel-thin-out bg-[#dce8f7] px-3 py-[2px] text-[11px]"
          onClick={() => onNav(-1)}
        >
          {t("ledger.prev")}
        </button>
        <span className="font-mono text-[10px] tracking-[0.12em] text-[#0369a1]">
          {pos + 1} / {total}
        </span>
        <button
          type="button"
          className="press bevel-thin-out bg-[#dce8f7] px-3 py-[2px] text-[11px]"
          onClick={() => onNav(1)}
        >
          {t("ledger.next")}
        </button>
      </div>
    </div>
  );
}

export default function Ledger() {
  const { t, lang } = useI18n();
  const api = useDesktop();
  const [sec, setSec] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [live, setLive] = useState<Edition[] | null>(null);

  const eds = live ?? EDITIONS;

  // The openDef render closure is captured at call time; a ref mirror keeps it
  // reading the freshest edition list (30-min repolls) and nav callback.
  const edsRef = useRef(eds);
  edsRef.current = eds;
  const openAtRef = useRef<(i: number) => void>(() => {});

  const openAt = useCallback(
    (i: number) => {
      const list = edsRef.current;
      if (list.length === 0) return;
      const pos = ((i % list.length) + list.length) % list.length;
      api.openDef({
        id: "news-detail",
        title: `The Daily Prophet · ${pos + 1}/${list.length}`,
        icon: <PixelIcon sprite={ChartIcon} size={14} />,
        ...NEWS_WIN,
        render: () => (
          <NewsDetail ed={list[pos]} pos={pos} total={list.length} onNav={(d) => openAtRef.current(pos + d)} />
        ),
      });
    },
    [api],
  );
  openAtRef.current = openAt;

  useEffect(() => {
    let alive = true;
    const pull = () =>
      getNewsToday()
        .then((res) => {
          // Empty payload (all feeds dead at fetch time) keeps the fallback —
          // an empty rotation would break the modulo below.
          const eds = liveEditions(res, lang);
          if (alive && eds.length > 0) setLive(eds);
        })
        .catch(() => {}); // silent: the 2000 back catalog holds the page
    void pull();
    const t = setInterval(pull, REPOLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [lang]);

  useEffect(() => {
    if (hoverPaused) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [hoverPaused]);

  const idx = Math.floor(sec / SECONDS_PER_EDITION) % eds.length;
  const ed = eds[idx];

  return (
    <aside
      className="ledger absolute bottom-[44px] right-2 z-[1] flex w-[304px] flex-col border border-[#9db4d6] bg-white text-[#0b1220] shadow-[3px_3px_0_rgba(0,0,0,0.35)]"
      style={{ height: CARD_H }}
      title="Newspapers are for reading, not for flashing."
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
    >
      <div className="flex items-end justify-between gap-1 bg-gradient-to-r from-[#0435c7] to-[#0ea5e9] px-2 pt-[5px] pb-[3px] text-[9px] text-white">
        <span className="shrink-0">25¢</span>
        <p className="font-display text-[26px] leading-none tracking-[0.03em]">The Daily Prophet</p>
        <span className="shrink-0">EST. 2000</span>
      </div>

      <div key={idx} className="ledger-turn flex min-h-0 flex-1 flex-col px-2 pt-[6px]">
        <div className="flex items-center justify-between py-[2px]">
          <span className="bg-[#0435c7] px-[6px] py-[1px] text-[9px] font-bold tracking-[0.12em] text-white">
            {lang === "en" ? ed.section : ed.sectionZh ?? ed.section}
          </span>
          <span className="font-mono text-[9px] tracking-[0.1em] text-[#0369a1]">{ed.date}</span>
        </div>
        <h3 className="mt-[6px] min-h-[44px] text-[20px] font-bold leading-[1.2] text-[#0b1220] line-clamp-3">
          <button
            type="button"
            className="w-full cursor-pointer text-left [font:inherit] underline-offset-4 decoration-[#0ea5e9] hover:underline"
            title={t("ledger.expand")}
            onClick={() => openAt(idx)}
          >
            {ed.headline}
          </button>
        </h3>
        <p className="mt-[4px] text-[9.5px] font-semibold leading-[1.4] tracking-[0.05em] text-[#0369a1] line-clamp-1">
          {ed.deck}
        </p>

        {/* Body fills whatever space remains at the fixed card height; more
            than 9 lines meets the line-clamp ellipsis. */}
        <div className="mt-[6px] min-h-0 flex-1 overflow-hidden">
          {ed.body ? (
            <p className="text-justify text-[12px] leading-[1.65] text-[#334155] line-clamp-9">
              {ed.body}
            </p>
          ) : (
            <ul className="space-y-[3px] pt-[2px]">
              {ed.index?.map((line, i) => (
                <li key={i} className="truncate text-[10px] leading-[1.4] text-[#334155]">
                  ▸ {line}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-[4px] border border-dashed border-[#9db4d6] bg-[#f0f7ff] px-1 py-[1px] text-center text-[9px] leading-[1.4] text-[#64748b]">
          {ed.classified}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-between px-2 pb-[3px] pt-[2px] text-[9px] tracking-[0.1em]">
        <span className="text-[#64748b]">ALL THE NEWS WORTH PRINTING</span>
        {live ? (
          <span className="flex items-center gap-[3px] font-bold text-[#0435c7]">
            <span className="inline-block h-[5px] w-[5px] animate-pulse rounded-full bg-[#0ea5e9]" />
            LIVE WIRE
          </span>
        ) : (
          <span className="text-[#64748b]">PAGE A1</span>
        )}
      </div>
    </aside>
  );
}
