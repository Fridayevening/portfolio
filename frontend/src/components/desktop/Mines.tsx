"use client";

// WINMINE.EXE — the classic minefield, kept honest. Two mercy rules over the
// 1995 original: the first click always opens a zero (mines are seeded skipping
// the clicked 3×3, so the board opens with a flood instead of a funeral), and
// clicking a satisfied number chords — opens its unflagged neighbors in one go.
// Best times are per-browser localStorage throwaways, not prefs-store material:
// losing them to another machine is part of the bit.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "./context";
import { useContextMenu } from "./ContextMenu";
import type { MenuItem } from "./menu";
import { StatusBar } from "./windows";
import { PixelIcon, type Sprite } from "./icons";
import { useI18n } from "../../lib/i18n/LanguageContext";

const CELL = 16;

const LEVELS = [
  { id: "beginner", labelKey: "mines.level.beginner", cols: 9, rows: 9, mines: 10 },
  { id: "intermediate", labelKey: "mines.level.intermediate", cols: 16, rows: 16, mines: 40 },
  { id: "expert", labelKey: "mines.level.expert", cols: 30, rows: 16, mines: 99 },
] as const;
type Level = (typeof LEVELS)[number];
type LevelId = Level["id"];
const levelOf = (id: LevelId): Level => LEVELS.find((l) => l.id === id)!;

// Classic digit palette, 1..8.
const NUM_COLOR = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#0a0a0a", "#808080"];

// ── Window fit ─────────────────────────────────────────
// Content column: p-[6px] root, 3 gaps of 6, 22px menu row, panel 38 (28 face +
// 2×5 padding), grid inset 3×2, 20px status bar — plus Window95's own chrome
// (29 vertical / 8 horizontal: p-[2px] + 22 titlebar + m-[2px]). Bench-measured
// against the real DOM (Playwright); keep in step with the classNames below.
export function minesWinSize(lv: Level) {
  return { w: lv.cols * CELL + 26, h: lv.rows * CELL + 147 };
}
export const MINES_GEOM = { ...minesWinSize(LEVELS[0]), x: 700, y: 150 } as const;

// ── Board logic (pure, module scope) ───────────────────

type Cell = {
  mine: boolean;
  open: boolean;
  /** 0 none · 1 flag · 2 question — the right-click cycle. */
  mark: 0 | 1 | 2;
  /** Adjacent mine count, filled at seed time. */
  n: number;
  /** Loss only: this flag was wrong — rendered mine-with-X in the reveal. */
  wrong?: boolean;
};

function freshBoard(lv: Level): Cell[] {
  return Array.from({ length: lv.cols * lv.rows }, () => ({ mine: false, open: false, mark: 0, n: 0 }));
}

function nbrs(i: number, lv: Level): number[] {
  const x = i % lv.cols;
  const y = Math.floor(i / lv.cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < lv.cols && ny >= 0 && ny < lv.rows) out.push(ny * lv.cols + nx);
    }
  return out;
}

// Fisher-Yates over the non-forbidden pool: mines can never land on the first
// click or its ring, and counts are recomputed afterwards.
function seedBoard(cells: Cell[], lv: Level, safe: number): Cell[] {
  const next = cells.map((c) => ({ ...c }));
  const forbidden = new Set([safe, ...nbrs(safe, lv)]);
  const pool = next.map((_, i) => i).filter((i) => !forbidden.has(i));
  for (let m = 0; m < lv.mines; m++) {
    const j = m + Math.floor(Math.random() * (pool.length - m));
    [pool[m], pool[j]] = [pool[j], pool[m]];
    next[pool[m]].mine = true;
  }
  next.forEach((c, i) => {
    if (!c.mine) c.n = nbrs(i, lv).filter((j) => next[j].mine).length;
  });
  return next;
}

// Iterative flood: open start, expand through zeros. Flagged cells never open.
function openFrom(cells: Cell[], lv: Level, start: number): Cell[] {
  const next = [...cells];
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    const c = next[i];
    if (c.open || c.mark === 1) continue;
    next[i] = { ...c, open: true };
    if (c.n === 0) for (const j of nbrs(i, lv)) if (!next[j].open) stack.push(j);
  }
  return next;
}

// ── Best times (read at dialog time only — no reactive store needed) ──────

const BEST_KEY = "newboy.winmine.best";
type Best = Partial<Record<LevelId, number>>;
function loadBest(): Best {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? "{}") as Best;
  } catch {
    return {};
  }
}
function saveBest(id: LevelId, t: number) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify({ ...loadBest(), [id]: t }));
  } catch {
    // private mode etc. — the record just doesn't survive the session
  }
}

// ── Sprites (game-internal, not desktop icons) ─────────

const MineGlyph: Sprite = {
  title: "Mine",
  rows: [
    "......k......",
    "......k......",
    "...k..k..k...",
    "....kkkkk....",
    "...kkwwkkk...",
    "..kkkkkkkkk..",
    "kkkkkkkkkkkkk",
    "..kkkkkkkkk..",
    "...kkkkkkk...",
    "....kkkkk....",
    "...k..k..k...",
    "......k......",
    "......k......",
  ],
};

const FlagGlyph: Sprite = {
  title: "Flag",
  rows: [
    ".rrrrr...",
    ".rrrrrr..",
    ".rrrrrrr.",
    ".rrrrrr..",
    ".rrrrr...",
    ".rkk.....",
    "..k......",
    "..k......",
    "..k......",
    "..k......",
    ".kkkk....",
    "kkkkkk...",
  ],
};

// ── Chrome widgets ─────────────────────────────────────

// Three-digit red LED; the unlit "888" underneath is the segment ghosting a
// real panel always shows. Values clamp to -99..999 like the original.
function Led({ value }: { value: number }) {
  const v = Math.max(-99, Math.min(999, value));
  const s = v < 0 ? `-${String(-v).padStart(2, "0")}` : String(v).padStart(3, "0");
  return (
    <div className="relative flex h-[24px] w-[44px] shrink-0 items-center justify-center overflow-hidden bg-[#0a0a0a] bevel-thin-in">
      <span className="absolute font-display text-[22px] leading-none text-[#2a0505]" aria-hidden>
        888
      </span>
      <span className="relative font-display text-[22px] leading-none text-[#ff2a2a]">{s}</span>
    </div>
  );
}

function Smiley({ mood }: { mood: "idle" | "ooh" | "dead" | "cool" }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden>
      <circle cx="10" cy="10" r="8.6" fill="#ffde00" stroke="#0a0a0a" strokeWidth="1" />
      {mood === "cool" ? (
        <>
          <rect x="4.5" y="6.5" width="11" height="3" fill="#0a0a0a" />
          <rect x="5.5" y="7" width="2" height="1" fill="#fff" />
          <path d="M6.5 13 Q10 15.5 13.5 13" stroke="#0a0a0a" strokeWidth="1.4" fill="none" />
        </>
      ) : mood === "dead" ? (
        <>
          <path d="M6 6.5 l2.5 2.5 M8.5 6.5 L6 9 M11.5 6.5 l2.5 2.5 M14 6.5 l-2.5 2.5" stroke="#0a0a0a" strokeWidth="1.2" />
          <path d="M7 14 Q10 12 13 14" stroke="#0a0a0a" strokeWidth="1.4" fill="none" />
        </>
      ) : mood === "ooh" ? (
        <>
          <circle cx="7" cy="7.5" r="1.1" fill="#0a0a0a" />
          <circle cx="13" cy="7.5" r="1.1" fill="#0a0a0a" />
          <circle cx="10" cy="12.8" r="2" fill="#0a0a0a" />
        </>
      ) : (
        <>
          <circle cx="7" cy="7.5" r="1.1" fill="#0a0a0a" />
          <circle cx="13" cy="7.5" r="1.1" fill="#0a0a0a" />
          <path d="M6.5 12.5 Q10 15.5 13.5 12.5" stroke="#0a0a0a" strokeWidth="1.4" fill="none" />
        </>
      )}
    </svg>
  );
}

// ── The game ───────────────────────────────────────────

export default function Mines() {
  const api = useDesktop();
  const menu = useContextMenu();
  const { t } = useI18n();
  const [lvId, setLvId] = useState<LevelId>("beginner");
  const lv = levelOf(lvId);
  const [cells, setCells] = useState<Cell[]>(() => freshBoard(LEVELS[0]));
  const [phase, setPhase] = useState<"ready" | "playing" | "won" | "lost">("ready");
  const [boom, setBoom] = useState<number | null>(null);
  const [time, setTime] = useState(0);
  const [ooh, setOoh] = useState(false);

  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => setTime((t) => Math.min(999, t + 1)), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // Loss tableau: unflagged mines reveal, flagged mines keep their flags (they
  // were right), wrong flags get marked for the X overlay.
  const lose = (board: Cell[], at: number) => {
    setCells(
      board.map((c) =>
        c.mine ? (c.mark === 1 ? c : { ...c, open: true }) : c.mark === 1 ? { ...c, wrong: true } : c,
      ),
    );
    setBoom(at);
    setPhase("lost");
  };

  const winDialog = () => {
    const best = loadBest();
    const prev = best[lvId];
    const record = prev === undefined || time < prev;
    if (record) saveBest(lvId, time);
    api.dialog(
      t("app.mines"),
      record
        ? [
            t("mines.newRecord"),
            t("mines.result").replace("{level}", t(lv.labelKey)).replace("{time}", String(time)),
            t("mines.recordQuip"),
          ]
        : [
            t("mines.cleared"),
            t("mines.recordResult")
              .replace("{level}", t(lv.labelKey))
              .replace("{time}", String(time))
              .replace("{record}", String(prev)),
            t("mines.clearedQuip"),
          ],
      "info",
    );
  };

  const settle = (next: Cell[]) => {
    const open = next.reduce((a, c) => a + (c.open ? 1 : 0), 0);
    if (open === next.length - lv.mines) {
      // Classic flourish: the win flags every remaining mine for you.
      setCells(next.map((c) => (c.mine ? { ...c, mark: 1 as const } : c)));
      setPhase("won");
      winDialog();
    } else {
      setCells(next);
    }
  };

  const chord = (i: number) => {
    const c = cells[i];
    if (c.n === 0) return;
    const around = nbrs(i, lv);
    if (around.filter((j) => cells[j].mark === 1).length !== c.n) return;
    let next = [...cells];
    let hit: number | null = null;
    for (const j of around) {
      const t = cells[j];
      if (t.open || t.mark === 1) continue;
      if (t.mine) {
        hit ??= j;
        next[j] = { ...t, open: true };
      } else {
        next = openFrom(next, lv, j);
      }
    }
    if (hit !== null) lose(next, hit);
    else settle(next);
  };

  const reveal = (i: number) => {
    if (phase === "won" || phase === "lost") return;
    const c = cells[i];
    if (c.open) {
      chord(i);
      return;
    }
    if (c.mark === 1) return;
    const board = phase === "ready" ? seedBoard(cells, lv, i) : cells;
    if (phase === "ready") setPhase("playing");
    if (board[i].mine) {
      lose(board, i);
      return;
    }
    settle(openFrom(board, lv, i));
  };

  const cycleMark = (i: number) => {
    if (phase === "won" || phase === "lost") return;
    const c = cells[i];
    if (c.open) return;
    const next = [...cells];
    next[i] = { ...c, mark: ((c.mark + 1) % 3) as 0 | 1 | 2 };
    setCells(next);
  };

  const reset = (id: LevelId = lvId) => {
    const target = levelOf(id);
    if (id !== lvId) {
      setLvId(id);
      // The window is noResize by design — difficulty changes refit it wholesale.
      api.fit("mines", minesWinSize(target).w, minesWinSize(target).h);
    }
    setCells(freshBoard(target));
    setPhase("ready");
    setBoom(null);
    setTime(0);
  };

  // ── Dropdown menus ──

  const check = (on: boolean): ReactNode => (
    <span className="w-[14px] text-center text-[12px] leading-none" aria-hidden>
      {on ? "✓" : ""}
    </span>
  );

  const gameItems = (): MenuItem[] => [
    { kind: "item", label: t("mines.newGame"), action: () => reset() },
    { kind: "sep" },
    ...LEVELS.map((l) => ({
      kind: "item" as const,
      label: t("mines.levelOption")
        .replace("{level}", t(l.labelKey))
        .replace("{cols}", String(l.cols))
        .replace("{rows}", String(l.rows))
        .replace("{mines}", String(l.mines)),
      icon: check(lvId === l.id),
      action: () => reset(l.id),
    })),
    { kind: "sep" },
    {
      kind: "item",
      label: t("mines.bestTimes"),
      action: () => {
        const best = loadBest();
        api.dialog(
          t("mines.bestTimesTitle"),
          [
            ...LEVELS.map((l) =>
              t("mines.bestLine")
                .replace("{level}", t(l.labelKey))
                .replace(
                  "{result}",
                  best[l.id] !== undefined
                    ? t("mines.bestSeconds").replace("{time}", String(best[l.id]))
                    : t("mines.noBest"),
                ),
            ),
            t("mines.localRecord"),
          ],
          "info",
        );
      },
    },
  ];

  // Toggle, not reopen: while a menu is open, its outside-dismiss (document
  // pointerdown, capture) closes it and React flushes before this component's
  // bubble handler runs — a DOM query here would see the menu already gone and
  // reopen it. So the "was a menu alive at pointerdown?" answer is snapshotted
  // in a capture listener of our own (registered at mount, i.e. ahead of the
  // menu layer's per-open listener) and handed over via the ref.
  const closedByThisClick = useRef(false);
  useEffect(() => {
    const onDown = () => {
      closedByThisClick.current = !!document.querySelector('[role="menu"]');
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

  const dropdown = (e: React.PointerEvent<HTMLButtonElement>, items: () => MenuItem[]) => {
    if (closedByThisClick.current) {
      closedByThisClick.current = false;
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    menu.openAt(r.left, r.bottom + 1, items);
  };

  // ── Render ──

  const flags = cells.reduce((a, c) => a + (c.mark === 1 ? 1 : 0), 0);
  const open = cells.reduce((a, c) => a + (c.open ? 1 : 0), 0);
  const mood = phase === "won" ? "cool" : phase === "lost" ? "dead" : ooh ? "ooh" : "idle";
  const statusLeft =
    phase === "ready"
      ? t("mines.ready")
      : phase === "playing"
        ? t("mines.playing")
            .replace("{flags}", String(flags))
            .replace("{mines}", String(lv.mines))
            .replace("{cells}", String(cells.length - open))
        : phase === "won"
          ? t("mines.won").replace("{time}", String(time))
          : t("mines.lost");

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none overflow-hidden gap-[6px] p-[6px]">
      {/* Menubar: the two labels are real dropdowns (the OS menu system, anchored
          under the label). */}
      <div className="flex h-[22px] shrink-0 items-center gap-1 text-[12px]">
        <button
          type="button"
          className="px-2 py-[2px] hover:bg-navy hover:text-white"
          onPointerDown={(e) => dropdown(e, gameItems)}
        >
          {t("mines.gameMenu")}
        </button>
        <button
          type="button"
          className="px-2 py-[2px] hover:bg-navy hover:text-white"
          onPointerDown={(e) =>
            dropdown(e, () => [
              {
                kind: "item",
                label: t("mines.aboutMenu"),
                action: () =>
                  api.dialog(
                    t("mines.aboutTitle"),
                    [t("mines.aboutProduct"), t("mines.aboutCopyright"), t("mines.aboutSafeStart")],
                    "info",
                  ),
              },
            ])
          }
        >
          {t("mines.helpMenu")}
        </button>
      </div>

      {/* Field column at natural width (w-fit), so the LED panel spans exactly
          the grid however the (unresizable) window is sized. */}
      <div className="flex w-fit flex-col flex-1 gap-[6px]">
        <div className="flex shrink-0 items-center justify-between p-[5px] bevel-in">
          <Led value={lv.mines - flags} />
          <button
            type="button"
            aria-label={t("mines.restartAria")}
            onClick={() => reset()}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center bevel-thin-out bg-chrome press"
          >
            <Smiley mood={mood} />
          </button>
          <Led value={time} />
        </div>

        <div
          role="grid"
          aria-label={t("mines.gridAria")}
          className="bevel-in bg-chrome p-[3px] touch-none"
          style={{ display: "grid", gridTemplateColumns: `repeat(${lv.cols}, ${CELL}px)` }}
          onPointerDown={(e) => {
            if (e.button === 0) setOoh(true);
          }}
          onPointerUp={() => setOoh(false)}
          onPointerLeave={() => setOoh(false)}
          onPointerCancel={() => setOoh(false)}
        >
          {cells.map((c, i) => {
            let cls = "bevel-thin-out bg-chrome";
            let content: ReactNode = null;
            if (c.open) {
              if (c.mine) {
                cls = boom === i ? "bg-[#ff0000]" : "border-t border-l border-[#808080]";
                content = <PixelIcon sprite={{ ...MineGlyph, title: t("mines.mine") }} size={13} />;
              } else if (c.n > 0) {
                cls = "border-t border-l border-[#808080]";
                content = (
                  <span className="font-bold text-[12px] leading-none" style={{ color: NUM_COLOR[c.n] }}>
                    {c.n}
                  </span>
                );
              } else {
                cls = "border-t border-l border-[#808080]";
              }
            } else if (c.mark === 1) {
              content = (
                <>
                  <PixelIcon sprite={{ ...FlagGlyph, title: t("mines.flag") }} size={12} />
                  {c.wrong && (
                    <span className="absolute font-bold text-[13px] leading-none text-[#ff0000]">×</span>
                  )}
                </>
              );
            } else if (c.mark === 2) {
              content = <span className="font-bold text-[12px] leading-none">?</span>;
            }
            return (
              <div
                key={i}
                role="gridcell"
                className={`relative flex h-[16px] w-[16px] items-center justify-center ${cls}`}
                onClick={() => reveal(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  cycleMark(i);
                }}
              >
                {content}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto shrink-0">
        <StatusBar left={statusLeft} right="WINMINE.EXE" />
      </div>
    </div>
  );
}
