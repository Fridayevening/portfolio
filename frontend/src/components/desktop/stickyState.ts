"use client";

// Desktop sticky notes: paper scraps spawned from the surface context menu.
// State lives outside React after the fsState.ts pattern — the spawn action sits
// in Desktop's menu, the layer in StickyNotes.tsx, and neither re-renders the
// other. Unlike fs nodes these are local scraps: persisted to localStorage, not
// the server.

import { useSyncExternalStore } from "react";

export type StickyNoteData = {
  id: string;
  x: number;
  y: number;
  /** Paper width in px; set at spawn, then only by edge pulls. */
  w: number;
  /** Manual height floor from a top/bottom edge pull, 0 = pure auto-grow. */
  mh: number;
  /** Index into PAPERS. */
  color: number;
  folded: boolean;
  /** Markdown-ish source: plain paragraphs plus "- [ ]" / "- [x]" todo lines,
   *  optionally ending in "@21:30" for a due-time reminder. */
  text: string;
  /** Body font size in px, always a rung of SIZE_LADDER. */
  size: number;
  /** Last measured height (ResizeObserver); a best-effort cache so the
   *  viewport-clamp pass has a footprint before the first re-measure. */
  h?: number;
};

export type StickyChime = {
  key: string;
  noteId: string;
  /** Line index in the note source at fire time; completeChime re-verifies it. */
  line: number;
  title: string;
  text: string;
  at: string;
  createdAt: number;
};

const KEY = "nb-sticky-notes";
const TASKBAR = 36;
const EDGE = 4;
/** Width of notes saved before the w field existed — they migrate at the size
 *  they actually were, not the new default. */
const LEGACY_W = 216;
export const DEFAULT_W = 260;
export const MIN_W = 150;
export const MIN_MH = 72;
export const FOLDED_H = 26;

// Zoom ladder (px) — rungs instead of free multiplication keep sizes from
// drifting into values like 10.73.
const SIZE_LADDER = [8, 9, 10.8, 12, 14, 16, 19, 22];
const DEFAULT_SIZE = 12;

// Paper stock swatches. All light enough that one ink set (TITLE/TEXT/SIG in
// StickyNotes.tsx) stays legible on every color; each swatch carries its own
// frame line so the border always reads as "darker paper", not a fixed gray.
export const PAPERS = [
  { nameKey: "sticky.paper.beige", paper: "#f4f1e4", frame: "#b9b19a" },
  { nameKey: "sticky.paper.lemon", paper: "#fff3a1", frame: "#cdb355" },
  { nameKey: "sticky.paper.pink", paper: "#f9dcd6", frame: "#cfa79e" },
  { nameKey: "sticky.paper.blue", paper: "#d3e3f2", frame: "#9db4cb" },
  { nameKey: "sticky.paper.green", paper: "#dde8cf", frame: "#a8bb92" },
] as const;

function nextSize(cur: number, dir: 1 | -1): number {
  let i = SIZE_LADDER.indexOf(cur);
  if (i < 0) {
    // A hand-edited or legacy value snaps to the nearest sensible rung first.
    i = SIZE_LADDER.findIndex((s) => s > cur);
    if (i < 0) i = SIZE_LADDER.length;
    if (dir < 0) i -= 1;
  }
  return SIZE_LADDER[Math.min(Math.max(i + dir, 0), SIZE_LADDER.length - 1)] ?? cur;
}

const EMPTY: StickyNoteData[] = [];

let notes: StickyNoteData[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

const persist = () => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // Quota/private-mode failures only lose persistence, never the session.
  }
};

const isNote = (v: unknown): v is Omit<StickyNoteData, "w" | "mh" | "color" | "folded" | "h"> & Partial<StickyNoteData> =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as StickyNoteData).id === "string" &&
  typeof (v as StickyNoteData).text === "string" &&
  typeof (v as StickyNoteData).x === "number" &&
  Number.isFinite((v as StickyNoteData).x) &&
  typeof (v as StickyNoteData).y === "number" &&
  Number.isFinite((v as StickyNoteData).y);

const clampX = (x: number, w: number) => Math.min(Math.max(x, EDGE), Math.max(EDGE, window.innerWidth - w - EDGE));
const clampY = (y: number, h: number) => Math.min(Math.max(y, EDGE), Math.max(EDGE, window.innerHeight - TASKBAR - h));

let restored = false;

/** One-shot localStorage restore, from a mount effect (the flag makes the
 *  StrictMode double-mount a no-op; a bad payload starts empty). Notes saved
 *  before the w/mh/color/folded fields existed migrate to their legacy values.
 *  Also the client-only spot where the page-lifetime services (viewport clamp,
 *  reminder ticker) are armed. */
export function restoreStickyNotes(): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(arr))
      notes = arr.filter(isNote).map((n) => ({
        ...n,
        w: typeof n.w === "number" && n.w >= MIN_W ? n.w : LEGACY_W,
        mh: typeof n.mh === "number" && n.mh >= 0 ? n.mh : 0,
        color: typeof n.color === "number" && n.color >= 0 && n.color < PAPERS.length ? n.color : 0,
        folded: n.folded === true,
        size: typeof n.size === "number" && Number.isFinite(n.size) ? n.size : DEFAULT_SIZE,
      }));
  } catch {
    // Corrupted payload: keep the empty start.
  }
  emit();
  // A saved position can be off-screen on a smaller viewport (the note was last
  // dragged on a bigger screen); the listener only covers later resizes.
  clampAllToViewport();
  window.addEventListener("resize", clampAllToViewport);
  setInterval(remindTick, 15_000);
}

// A shrunk viewport must not strand scraps off-screen; mirroring the per-drag
// clamp wholesale is the cheapest way to keep every note reachable.
function clampAllToViewport(): void {
  let changed = false;
  notes = notes.map((n) => {
    const h = n.folded ? FOLDED_H : (n.h ?? MIN_MH);
    const x = clampX(n.x, n.w);
    const y = clampY(n.y, h);
    if (x === n.x && y === n.y) return n;
    changed = true;
    return { ...n, x, y };
  });
  if (changed) {
    persist();
    emit();
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** The note spawned last should mount straight into the editor. A slot read
 *  through peek (idempotent — the scrap's useState initializer runs twice under
 *  StrictMode) and cleared once by the layer's mount effect. */
let pendingEdit: string | null = null;

/** Spawn at the right-click position, clamped on screen; repeated spawns at the
 *  same spot cascade instead of stacking pixel-perfect. */
export function addStickyNote(x: number, y: number, defaultText = "Sticky note"): void {
  const id = `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const step = (notes.length % 5) * 16;
  notes = [
    ...notes,
    {
      id,
      x: clampX(Math.round(x) + step, DEFAULT_W),
      y: clampY(Math.round(y) + step, MIN_MH * 2),
      w: DEFAULT_W,
      mh: 0,
      color: 0,
      folded: false,
      text: defaultText,
      size: DEFAULT_SIZE,
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

/** Duplicate a scrap one cascade step away — same content, unfolded, not
 *  auto-editing (the copy is about placement, not rewriting). */
export function copyStickyNote(id: string): void {
  const src = notes.find((n) => n.id === id);
  if (!src) return;
  notes = [
    ...notes,
    {
      ...src,
      id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      x: clampX(src.x + 24, src.w),
      y: clampY(src.y + 24, src.h ?? MIN_MH),
      folded: false,
    },
  ];
  persist();
  emit();
}

/** Move is called per pointermove during a drag; the caller clamps against the
 *  live measured size (height varies with content, which the store can't know). */
export function moveStickyNote(id: string, x: number, y: number): void {
  notes = notes.map((n) => (n.id === id ? { ...n, x, y } : n));
  persist();
  emit();
}

/** Resize is also per pointermove; x/y shift when the west/north edges are
 *  pulled. mh doubles as the "user touched the height" marker. */
export function resizeStickyNote(id: string, x: number, y: number, w: number, mh: number): void {
  notes = notes.map((n) => (n.id === id ? { ...n, x, y, w, mh } : n));
  persist();
  emit();
}

/** Footprint cache fed by each scrap's ResizeObserver, so the viewport clamp
 *  has sizes without waiting for a drag. In-place and silent: no array swap,
 *  no emit, no persist churn per keystroke. */
export function noteMeasured(id: string, h: number): void {
  const n = notes.find((x) => x.id === id);
  if (n && n.h !== h) n.h = h;
}

export function setStickyText(id: string, text: string): void {
  notes = notes.map((n) => (n.id === id ? { ...n, text } : n));
  persist();
  emit();
}

export function setStickyColor(id: string, color: number): void {
  notes = notes.map((n) => (n.id === id && n.color !== color ? { ...n, color } : n));
  persist();
  emit();
}

export function toggleStickyFold(id: string, folded?: boolean): void {
  notes = notes.map((n) => (n.id === id && n.folded !== (folded ?? !n.folded) ? { ...n, folded: folded ?? !n.folded } : n));
  persist();
  emit();
}

/** One zoom step along SIZE_LADDER (dir = +1 / -1); a no-op at the ends. */
export function stepStickySize(id: string, dir: 1 | -1): void {
  let changed = false;
  notes = notes.map((n) => {
    if (n.id !== id) return n;
    const size = nextSize(n.size, dir);
    if (size === n.size) return n;
    changed = true;
    return { ...n, size };
  });
  if (changed) {
    persist();
    emit();
  }
}

export function resetStickySize(id: string): void {
  notes = notes.map((n) => (n.id === id && n.size !== DEFAULT_SIZE ? { ...n, size: DEFAULT_SIZE } : n));
  persist();
  emit();
}

// ── Delete with undo ──────────────────────────────────────────────────────────

// Single slot: deleting again while the toast is up drops the older scrap for
// good — one rescue buffer, like the real desk.
let deleted: { note: StickyNoteData; index: number } | null = null;
let deletedTimer: ReturnType<typeof setTimeout> | null = null;

export function removeStickyNote(id: string): void {
  const index = notes.findIndex((n) => n.id === id);
  if (index < 0) return;
  deleted = { note: notes[index], index };
  if (deletedTimer) clearTimeout(deletedTimer);
  deletedTimer = setTimeout(() => {
    deleted = null;
    deletedTimer = null;
    emit();
  }, 6000);
  notes = notes.filter((n) => n.id !== id);
  persist();
  emit();
}

export function undoStickyDelete(): void {
  if (!deleted) return;
  if (deletedTimer) clearTimeout(deletedTimer);
  deletedTimer = null;
  const { note, index } = deleted;
  deleted = null;
  notes = [...notes.slice(0, index), note, ...notes.slice(index)];
  persist();
  emit();
}

// ── Locate flash (manager → desk) ─────────────────────────────────────────────

let flash: { id: string; at: number } | null = null;
let flashTimer: ReturnType<typeof setTimeout> | null = null;

/** Blink a scrap's frame for ~1.5s so the manager's locate action works without any
 *  z-order games (the layer is deliberately creation-ordered). */
export function flashNote(id: string): void {
  flash = { id, at: Date.now() };
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash = null;
    flashTimer = null;
    emit();
  }, 1600);
  emit();
}

// ── Reminders ─────────────────────────────────────────────────────────────────

// A "@HH:MM" at the end of an unchecked todo line arms a reminder. Times are
// daily: a due that already passed arms for tomorrow, so an unchecked item
// nags once a day until it is checked off. Firing needs the page open within a
// short window of the due time — a scrap is not an alarm service.

const TIME_RE = /(?:^|\s)@([0-9]{1,2}):([0-9]{2})\s*$/;
/** A reminder only fires while the page has been open this close to the due
 *  time; any later is a miss, not a fire. */
const FIRE_WINDOW_MS = 10 * 60 * 1000;
const CHIME_LIFETIME_MS = 25_000;
const MAX_CHIMES = 3;

/** Splits a todo line's trailing "@HH:MM" off its body; null when no valid
 *  time is present. */
export function splitTodoTime(text: string): { body: string; at: string } | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { body: text.slice(0, m.index).trimEnd(), at: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

/** First non-blank non-todo line, for toasts and the manager list. */
export function stickyTitle(text: string, fallback = "Sticky note"): string {
  const line = text.split("\n").find((l) => l.trim() !== "" && !TODO_RE.test(l));
  return (line ?? "").trim().slice(0, 24) || fallback;
}

let chimes: StickyChime[] = [];
const snoozed: (StickyChime & { due: number })[] = [];
const fired = new Map<string, number>();

function pushChime(c: StickyChime): void {
  chimes = [...chimes, c].slice(-MAX_CHIMES);
}

function remindTick(): void {
  const now = Date.now();
  let changed = false;

  for (const [k, due] of fired) if (now - due > 48 * 3600_000) fired.delete(k);
  for (let i = snoozed.length - 1; i >= 0; i--) {
    if (now < snoozed[i].due) continue;
    pushChime({ ...snoozed[i], createdAt: now });
    snoozed.splice(i, 1);
    changed = true;
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  for (const n of notes) {
    parseStickyText(n.text).forEach((l, i) => {
      if (l.kind !== "todo" || l.done) return;
      const t = splitTodoTime(l.text);
      if (!t) return;
      const [hh, mm] = t.at.split(":").map(Number);
      const due = startOfDay.getTime() + (hh * 60 + mm) * 60_000;
      if (now < due || now - due >= FIRE_WINDOW_MS) return;
      const key = `${n.id}:${i}:${due}`;
      if (fired.has(key)) return;
      fired.set(key, due);
      pushChime({ key, noteId: n.id, line: i, title: stickyTitle(n.text), text: t.body, at: t.at, createdAt: now });
      changed = true;
    });
  }

  if (chimes.some((c) => now - c.createdAt > CHIME_LIFETIME_MS)) {
    chimes = chimes.filter((c) => now - c.createdAt <= CHIME_LIFETIME_MS);
    changed = true;
  }
  if (changed) emit();
}

export function dismissChime(key: string): void {
  chimes = chimes.filter((c) => c.key !== key);
  emit();
}

export function snoozeChime(key: string, minutes = 5): void {
  const c = chimes.find((x) => x.key === key);
  if (!c) return;
  chimes = chimes.filter((x) => x.key !== key);
  snoozed.push({ ...c, due: Date.now() + minutes * 60_000 });
  emit();
}

/** Check the todo off from its toast. The stored line index is re-verified —
 *  if the note was edited since firing, the check is dropped, not misplaced. */
export function completeChime(key: string): void {
  const c = chimes.find((x) => x.key === key);
  if (!c) return;
  const note = notes.find((n) => n.id === c.noteId);
  if (note) {
    const line = parseStickyText(note.text)[c.line];
    if (line?.kind === "todo" && !line.done) {
      setStickyText(note.id, toggleStickyLine(note.text, c.line));
    }
  }
  dismissChime(key);
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

const NO_CHIMES: StickyChime[] = [];

export function useStickyNotes(): StickyNoteData[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => notes,
    () => EMPTY,
  );
}

export function useStickyDeleted(): { note: StickyNoteData; index: number } | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deleted,
    () => null,
  );
}

export function useStickyChimes(): StickyChime[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => chimes,
    () => NO_CHIMES,
  );
}

export function useStickyFlash(): { id: string; at: number } | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => flash,
    () => null,
  );
}

// ── Markdown-ish scrap grammar ────────────────────────────────────────────────
// A note is paragraphs plus GFM task-list items: "- [ ]" / "- [x]" lines render
// as live checkboxes, everything else as text (the first non-blank paragraph
// gets the bold title look). No other markdown, by design.

export type StickyLine =
  | { kind: "todo"; done: boolean; text: string }
  | { kind: "para"; text: string; title: boolean };

const TODO_RE = /^(\s*)([-*])\s*\[( |x|X)\]\s?(.*)$/;

export function parseStickyText(text: string): StickyLine[] {
  let titled = false;
  return text.split("\n").map((raw) => {
    const m = TODO_RE.exec(raw);
    if (m) return { kind: "todo" as const, done: m[3] !== " ", text: m[4] };
    const title = !titled && raw.trim() !== "";
    if (title) titled = true;
    return { kind: "para" as const, text: raw, title };
  });
}

/** Flip the marker of line `line` ("- [ ]" ↔ "- [x]"), keeping the user's own
 *  list punctuation and indentation. */
export function toggleStickyLine(text: string, line: number): string {
  const lines = text.split("\n");
  const m = TODO_RE.exec(lines[line] ?? "");
  if (!m) return text;
  lines[line] = `${m[1]}${m[2]} [${m[3] === " " ? "x" : " "}] ${m[4]}`;
  return lines.join("\n");
}
