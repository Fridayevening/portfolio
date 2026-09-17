"use client";

// Bare desk texts: plain words written straight onto the surface (no paper),
// spawned from the surface context menu next to sticky notes. Same external
// store shape as stickyState.ts — local scraps, persisted to localStorage,
// never the server.

import { useSyncExternalStore } from "react";

export type DeskTextData = {
  id: string;
  x: number;
  y: number;
  text: string;
  /** Style preset: body = handwriting stack, title = pixel display stack. */
  font: DeskFont;
  /** Body font size in px: a ladder rung, or any value past the top rung
 *  (zoom is unbounded above the ladder). */
  size: number;
  /** Rotation in degrees; the menu steps it by 5. */
  deg: number;
  /** Index into INKS. */
  ink: number;
  /** Pinned: renders on the front layer above every window. Absent = default
   *  desk surface, coverable like the rest of the scraps. */
  top?: boolean;
  /** Last measured footprint (ResizeObserver), cached so the viewport-clamp
   *  pass has a size before the first re-measure. */
  w?: number;
  h?: number;
};

const KEY = "nb-desk-texts";
const TASKBAR = 36;
const EDGE = 4;
const MIN_FOOTPRINT = 24;

// Same rung ladder as the sticky notes; the default sits on the top rung —
// the navy selection box reads as a placard, so it spawns big, not 12px-UI.
const SIZE_LADDER = [8, 9, 10.8, 12, 14, 16, 19, 22];
const DEFAULT_SIZE = 22;
// Title rungs sit on multiples of the 12px Fusion Pixel CJK grid so hanzi stay
// crisp bitmaps at every zoom step; titles start big — that is the point.
const TITLE_SIZE_LADDER = [24, 36, 48, 60];
const TITLE_DEFAULT_SIZE = 24;

export type DeskFont = "body" | "title";

const ladderOf = (font: DeskFont) => (font === "title" ? TITLE_SIZE_LADDER : SIZE_LADDER);
const defaultSizeOf = (font: DeskFont) => (font === "title" ? TITLE_DEFAULT_SIZE : DEFAULT_SIZE);
const topOf = (font: DeskFont) => ladderOf(font)[ladderOf(font).length - 1];

function nextSize(cur: number, dir: 1 | -1, font: DeskFont): number {
  const ladder = ladderOf(font);
  let i = ladder.indexOf(cur);
  if (i < 0) {
    // A hand-edited or legacy value snaps to the nearest sensible rung first.
    i = ladder.findIndex((s) => s > cur);
    if (i < 0) i = ladder.length;
    if (dir < 0) i -= 1;
  }
  return ladder[Math.min(Math.max(i + dir, 0), ladder.length - 1)] ?? cur;
}

/** Nearest rung of a preset's ladder — used when switching presets, where the
 *  old size belongs to the other ladder's scale. */
function snapSize(size: number, font: DeskFont): number {
  const ladder = ladderOf(font);
  return ladder.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), ladder[0]);
}

// Ink swatches. One scheme for now (white on the navy selection box); the
// per-item `ink` index stays so more can be appended without a migration.
export const INKS = [{ name: "White", color: "#ffffff" }] as const;

const EMPTY: DeskTextData[] = [];

let texts: DeskTextData[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const persist = () => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(texts));
  } catch {
    // Quota/private-mode failures only lose persistence, never the session.
  }
};

const isText = (v: unknown): v is Omit<DeskTextData, "size" | "ink" | "w" | "h"> & Partial<DeskTextData> =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as DeskTextData).id === "string" &&
  typeof (v as DeskTextData).text === "string" &&
  typeof (v as DeskTextData).x === "number" &&
  Number.isFinite((v as DeskTextData).x) &&
  typeof (v as DeskTextData).y === "number" &&
  Number.isFinite((v as DeskTextData).y);

const clampX = (x: number, w: number) => Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - w - EDGE));
const clampY = (y: number, h: number) => Math.min(Math.max(y, EDGE), Math.max(EDGE, window.innerHeight - TASKBAR - h));

let restored = false;

/** One-shot localStorage restore, from a mount effect (the flag makes the
 *  StrictMode double-mount a no-op; a bad payload starts empty). Blank items
 *  are dropped on the way in — an empty text has no visual and must not leave
 *  an invisible hit box behind. Also arms the page-lifetime viewport clamp. */
export function restoreDeskTexts(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(arr))
      texts = arr
        .filter(isText)
        .filter((t) => t.text.trim() !== "")
        .map((t) => {
          const font: DeskFont = t.font === "title" ? "title" : "body";
          return {
            ...t,
            font,
            // Free sizes above the ladder top are legal (unbounded zoom); only
            // garbage (non-finite, sub-4px) snaps back to the preset default.
            size: typeof t.size === "number" && Number.isFinite(t.size) && t.size >= 4 ? t.size : defaultSizeOf(font),
            deg: typeof t.deg === "number" && Number.isFinite(t.deg) ? Math.round(t.deg) : 0,
            ink: typeof t.ink === "number" && t.ink >= 0 && t.ink < INKS.length ? t.ink : 0,
            top: t.top === true ? true : undefined,
          };
        });
  } catch {
    // Corrupted payload: keep the empty start.
  }
  emit();
  clampAllToViewport();
  window.addEventListener("resize", clampAllToViewport);
}

// A shrunk viewport must not strand texts off-screen.
function clampAllToViewport(): void {
  let changed = false;
  texts = texts.map((t) => {
    const x = clampX(t.x, t.w ?? MIN_FOOTPRINT);
    const y = clampY(t.y, t.h ?? MIN_FOOTPRINT);
    if (x === t.x && y === t.y) return t;
    changed = true;
    return { ...t, x, y };
  });
  if (changed) {
    persist();
    emit();
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** The text spawned last should mount straight into the editor. A slot read
 *  through peek (idempotent — the item's useState initializer runs twice under
 *  StrictMode) and cleared by the layer's mount effect plus the item's first
 *  commit: a lingering slot would resurrect the editor whenever the item
 *  remounts (e.g. a pin toggle moves it between layers). */
let pendingEdit: string | null = null;

/** Spawn an empty text at the right-click position, clamped on screen;
 *  repeated spawns at the same spot cascade instead of stacking. */
export function addDeskText(x: number, y: number): void {
  const id = `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const step = (texts.length % 5) * 16;
  texts = [
    ...texts,
    {
      id,
      x: clampX(Math.round(x) + step, MIN_FOOTPRINT),
      y: clampY(Math.round(y) + step, MIN_FOOTPRINT),
      text: "",
      font: "body",
      size: DEFAULT_SIZE,
      deg: 0,
      ink: 0,
    },
  ];
  pendingEdit = id;
  persist();
  emit();
}

export function peekPendingEdit(): string | null {
  return pendingEdit;
}

export function clearPendingEdit(): void {
  pendingEdit = null;
}

/** Duplicate a text one cascade step away — same ink and size, not auto-editing
 *  (the copy is about placement, not rewriting). */
export function copyDeskText(id: string): void {
  const src = texts.find((t) => t.id === id);
  if (!src) return;
  texts = [
    ...texts,
    {
      ...src,
      id: `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: clampX(src.x + 24, src.w ?? MIN_FOOTPRINT),
      y: clampY(src.y + 24, src.h ?? MIN_FOOTPRINT),
    },
  ];
  persist();
  emit();
}

/** Move is called per pointermove during a drag; the caller clamps against the
 *  live measured size. */
export function moveDeskText(id: string, x: number, y: number): void {
  texts = texts.map((t) => (t.id === id ? { ...t, x, y } : t));
  persist();
  emit();
}

export function setDeskText(id: string, text: string): void {
  texts = texts.map((t) => (t.id === id ? { ...t, text } : t));
  persist();
  emit();
}

export function setDeskInk(id: string, ink: number): void {
  texts = texts.map((t) => (t.id === id && t.ink !== ink ? { ...t, ink } : t));
  persist();
  emit();
}

/** Switch style preset; the size snaps to the nearest rung of the target
 *  ladder — a 14px scrawl becomes a 24px title, not a blurry 14px one. */
export function setDeskFont(id: string, font: DeskFont): void {
  texts = texts.map((t) => (t.id === id && t.font !== font ? { ...t, font, size: snapSize(t.size, font) } : t));
  persist();
  emit();
}

/** One zoom step (dir = +1 / -1). On the ladder it walks rungs; above the top
 *  rung the ladder ends but zooming does not — sizes keep growing by thirds
 *  (and shrink back by thirds until they land on the top rung again). */
export function stepDeskSize(id: string, dir: 1 | -1): void {
  let changed = false;
  texts = texts.map((t) => {
    if (t.id !== id) return t;
    const top = topOf(t.font);
    const size =
      dir > 0
        ? t.size < top
          ? nextSize(t.size, 1, t.font)
          : Math.round((t.size * 4) / 3)
        : t.size > top
          ? Math.max(top, Math.round((t.size * 3) / 4))
          : nextSize(t.size, -1, t.font);
    if (size === t.size) return t;
    changed = true;
    return { ...t, size };
  });
  if (changed) {
    persist();
    emit();
  }
}

/** Rotate by a delta in degrees (the menu steps ±5; reset passes -deg). */
export function rotateDeskText(id: string, delta: number): void {
  texts = texts.map((t) => (t.id === id ? { ...t, deg: Math.round(t.deg + delta) } : t));
  persist();
  emit();
}

export function toggleDeskTop(id: string): void {
  texts = texts.map((t) => (t.id === id ? { ...t, top: !t.top } : t));
  persist();
  emit();
}

export function resetDeskSize(id: string): void {
  texts = texts.map((t) =>
    t.id !== id || t.size === defaultSizeOf(t.font) ? t : { ...t, size: defaultSizeOf(t.font) },
  );
  persist();
  emit();
}

export function removeDeskText(id: string): void {
  texts = texts.filter((t) => t.id !== id);
  persist();
  emit();
}

/** Footprint cache fed by each item's ResizeObserver, so the viewport clamp
 *  has sizes without waiting for a drag. In-place and silent: no array swap,
 *  no emit, no persist churn per keystroke. */
export function textMeasured(id: string, w: number, h: number): void {
  const t = texts.find((x) => x.id === id);
  if (t && (t.w !== w || t.h !== h)) {
    t.w = w;
    t.h = h;
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useDeskTexts(): DeskTextData[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => texts,
    () => EMPTY,
  );
}
