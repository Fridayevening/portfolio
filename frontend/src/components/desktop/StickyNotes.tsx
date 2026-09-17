"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as RKeyboardEvent,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
} from "react";
import { useContextMenu } from "./ContextMenu";
import {
  FOLDED_H,
  MIN_MH,
  MIN_W,
  PAPERS,
  clearPendingEdit,
  completeChime,
  copyStickyNote,
  dismissChime,
  moveStickyNote,
  noteMeasured,
  parseStickyText,
  peekPendingEdit,
  removeStickyNote,
  resetStickySize,
  restoreStickyNotes,
  resizeStickyNote,
  setStickyColor,
  setStickyText,
  snoozeChime,
  splitTodoTime,
  stepStickySize,
  stickyTitle,
  toggleStickyFold,
  toggleStickyLine,
  undoStickyDelete,
  useStickyChimes,
  useStickyDeleted,
  useStickyFlash,
  useStickyNotes,
  type StickyChime,
  type StickyNoteData,
} from "./stickyState";
import { useI18n } from "../../lib/i18n/LanguageContext";

// The paper-scrap look is lifted from DisclaimerNote (the "A NOTE ABOUT ALL
// THIS" note): beige stock, frame line, double shadow, tape, Tahoma. Paper and
// frame colors come from the per-note swatch (stickyState PAPERS); one ink set
// serves every swatch.
const TITLE = "#1f1d17";
const TEXT = "#2f2c24";
const SIG = "#86806c";
const TASKBAR = 36;
const EDGE = 4;
const FONT =
  'Tahoma, "MS Sans Serif", Geneva, Verdana, "PingFang SC", "Microsoft YaHei", sans-serif';

// Deterministic per-note tilt (-1.5°…1.5°): the same id always leans the same
// way, like scraps flicked onto the desk.
const tilt = (id: string) =>
  (([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 11) - 5) * 0.3;

export default function StickyNotes() {
  const notes = useStickyNotes();
  const deleted = useStickyDeleted();
  const chimes = useStickyChimes();
  useEffect(() => {
    restoreStickyNotes();
    // The spawn-to-edit slot only ever applies to scraps mounting after a
    // spawn; by layer-mount time it can only be a stale leftover.
    clearPendingEdit();
  }, []);
  // The layer itself must not catch surface clicks/right-clicks: only the
  // scraps and toasts take pointer events, the sheet passes them through.
  return (
    <div className="pointer-events-none absolute inset-0 z-[12]">
      {notes.map((n) => (
        <StickyScrap key={n.id} note={n} />
      ))}
      {(deleted || chimes.length > 0) && (
        <div className="pointer-events-auto absolute right-[10px] bottom-[44px] z-[13] flex flex-col items-end gap-[6px]">
          {deleted && <UndoToast note={deleted.note} />}
          {chimes.map((c) => (
            <ChimeToast key={c.key} chime={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function UndoToast({ note }: { note: StickyNoteData }) {
  const { t } = useI18n();
  const sw = PAPERS[note.color] ?? PAPERS[0];
  return (
    <div
      className="sticky-pop flex items-center gap-[10px] px-[10px] py-[6px] text-[11px] leading-[1.4]"
      style={{ background: sw.paper, color: TEXT, fontFamily: FONT, boxShadow: `0 0 0 1px ${sw.frame}, 2px 3px 8px rgba(0,0,0,.3)` }}
    >
      <span className="max-w-[180px] truncate">{t("sticky.deleted").replace("{title}", stickyTitle(note.text, t("sticky.title")))}</span>
      <button
        type="button"
        className="bevel-thin-out bg-chrome px-[10px] py-[2px] text-[11px] press"
        onClick={undoStickyDelete}
      >
        {t("sticky.undo")}
      </button>
    </div>
  );
}

function ChimeToast({ chime }: { chime: StickyChime }) {
  const { t } = useI18n();
  // The reminder toast takes the lemon swatch — it must outrank every paper it
  // might sit over on the desk.
  const sw = PAPERS[1];
  return (
    <div
      className="sticky-pop flex w-[224px] flex-col gap-[4px] px-[10px] py-[7px] text-[11px] leading-[1.4]"
      style={{ background: sw.paper, color: TEXT, fontFamily: FONT, boxShadow: `0 0 0 1px ${sw.frame}, 2px 3px 8px rgba(0,0,0,.3)` }}
      role="alert"
    >
      <span className="font-bold" style={{ color: SIG }}>
        {t("sticky.reminder").replace("{time}", chime.at)}
      </span>
      <span className="break-words">
        <b style={{ color: TITLE }}>{chime.title}</b>
        {chime.text ? ` — ${chime.text}` : ""}
      </span>
      <div className="flex gap-[6px] pt-[2px]">
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-[8px] py-[1px] text-[11px] press"
          onClick={() => completeChime(chime.key)}
        >
          {t("sticky.done")}
        </button>
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-[8px] py-[1px] text-[11px] press"
          onClick={() => snoozeChime(chime.key)}
        >
          {t("sticky.snooze")}
        </button>
        <button
          type="button"
          aria-label={t("sticky.dismiss")}
          className="ml-auto self-start px-[2px] text-[10px] leading-none hover:text-[#b02020]"
          onClick={() => dismissChime(chime.key)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

type Edge = "n" | "s" | "e" | "w";

// Hit strips on the four paper edges; the class strings are kept here so the
// render below stays a flat map.
const EDGE_HIT: Record<Edge, string> = {
  w: "left-0 top-[6px] bottom-[6px] w-[7px] cursor-ew-resize",
  e: "right-0 top-[6px] bottom-[6px] w-[7px] cursor-ew-resize",
  n: "top-0 left-[8px] right-[8px] h-[7px] cursor-ns-resize",
  s: "bottom-0 left-[8px] right-[8px] h-[7px] cursor-ns-resize",
};

function StickyScrap({ note }: { note: StickyNoteData }) {
  const { t } = useI18n();
  // A fresh spawn mounts straight into the editor: the initial state (not an
  // effect) reads the store's idempotent peek slot, so StrictMode's double
  // initializer run can't consume it out from under the note.
  const [editing, setEditing] = useState(() => peekPendingEdit() === note.id);
  const [draft, setDraft] = useState(note.text);
  const paper = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const menu = useContextMenu();
  const chimes = useStickyChimes();
  const flash = useStickyFlash();
  // Same capture-drag scheme as DesktopIcon; the live rect is kept so the clamp
  // knows the content height, which varies per note.
  const drag = useRef<{
    px: number;
    py: number;
    dx: number;
    dy: number;
    w: number;
    h: number;
    moved: boolean;
  } | null>(null);
  const rsz = useRef<{
    edge: Edge;
    px: number;
    py: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const movedAt = useRef(0);

  const sw = PAPERS[note.color] ?? PAPERS[0];
  const deg = tilt(note.id);
  const todos = parseStickyText(note.text).filter((l) => l.kind === "todo");

  const startEdit = () => {
    setDraft(note.text);
    setEditing(true);
  };
  // refocus: Escape keeps the user on the note (⌘/Ctrl +/- stays live); a blur
  // commit means they clicked away, and must not have focus yanked back.
  const commit = (refocus: boolean) => {
    setEditing(false);
    if (draft !== note.text) setStickyText(note.id, draft);
    if (refocus) paper.current?.focus();
  };
  // Font zoom, scoped to the focused note: ⌘ (Mac) / Ctrl (Win/Linux) + = / - / 0.
  // Either modifier is accepted — Ctrl on a Mac is harmless — and the keydown is
  // swallowed so the browser's page zoom never fires while a note holds focus.
  // Content spacing is in em, so the whole scrap scales off this one knob.
  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "=" || e.key === "+" || e.key === "Add") {
      e.preventDefault();
      stepStickySize(note.id, 1);
    } else if (e.key === "-" || e.key === "_" || e.key === "Subtract") {
      e.preventDefault();
      stepStickySize(note.id, -1);
    } else if (e.key === "0") {
      e.preventDefault();
      resetStickySize(note.id);
    }
  };

  // Enter-edit only: focus and park the caret at the end. Running this per
  // keystroke would drag mid-text typing back to the tail.
  useEffect(() => {
    if (!editing || !area.current) return;
    const el = area.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);
  // Auto-grow to fit the source lines.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  // Live footprint cache for the store's viewport clamp (in-memory, no emit).
  useEffect(() => {
    const el = paper.current;
    if (!el) return;
    const ro = new ResizeObserver(() => noteMeasured(note.id, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [note.id]);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    // Interactive children (checkbox / delete / resize strips) must keep their
    // own clicks — pointer capture would retarget the following click to the paper.
    if (e.target instanceof Element && e.target.closest("button, textarea, .rsz")) return;
    // Grab offsets are taken against the stored x/y, not getBoundingClientRect:
    // the rect is the rotated bounding box, and its tilt offset (±3px) would
    // leak into every drag, leaving the paper trailing the cursor. The rect is
    // still measured for the clamp — the rotated footprint is what must stay
    // on screen.
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      dx: e.clientX - note.x,
      dy: e.clientY - note.y,
      w: r.width,
      h: r.height,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // Movement under 4px reads as hand tremor, not a drag — leave it to click.
    if (!d.moved) {
      if (Math.abs(e.clientX - d.px) < 4 && Math.abs(e.clientY - d.py) < 4) return;
      d.moved = true;
    }
    const x = Math.min(Math.max(e.clientX - d.dx, EDGE), window.innerWidth - d.w - EDGE);
    const y = Math.min(Math.max(e.clientY - d.dy, EDGE), window.innerHeight - TASKBAR - d.h);
    moveStickyNote(note.id, Math.round(x), Math.round(y));
  };
  const onUp = () => {
    if (drag.current?.moved) movedAt.current = Date.now();
    drag.current = null;
  };
  const onClickPaper = () => {
    if (editing) return;
    // The click released right after a drag must not open the editor.
    if (Date.now() - movedAt.current < 400) return;
    if (note.folded) {
      toggleStickyFold(note.id, false);
      return;
    }
    startEdit();
  };
  const onCtx = (e: RMouseEvent<HTMLDivElement>) => {
    // While editing, leave right-clicks to the textarea's caret menu.
    if (editing) return;
    menu.open(e, [
      {
        kind: "item",
        label: t("sticky.edit"),
        action: () => {
          toggleStickyFold(note.id, false);
          startEdit();
        },
      },
      { kind: "sep" },
      {
        kind: "item",
        label: t("sticky.paperColor"),
        sub: PAPERS.map((p, i) => ({
          kind: "item" as const,
          label: t(p.nameKey),
          icon: (
            <span
              className="inline-block h-[12px] w-[12px]"
              style={{ background: p.paper, boxShadow: `0 0 0 1px ${p.frame}` }}
            />
          ),
          disabled: i === note.color,
          action: () => setStickyColor(note.id, i),
        })),
      },
      {
        kind: "item",
        label: note.folded ? t("sticky.expand") : t("sticky.fold"),
        action: () => toggleStickyFold(note.id),
      },
      { kind: "item", label: t("sticky.copy"), action: () => copyStickyNote(note.id) },
      { kind: "sep" },
      { kind: "item", label: t("sticky.delete"), danger: true, action: () => removeStickyNote(note.id) },
    ]);
  };

  // Edge pulls. E/W restate the width; N/S restate the height floor (mh) with a
  // y compensation on the north pull. Widths are clamped to the viewport; the
  // paper's real height is max(mh, content), so pulling above the content is
  // simply held by it.
  const startRsz = (e: RPointerEvent<HTMLDivElement>, edge: Edge) => {
    e.stopPropagation();
    e.preventDefault();
    rsz.current = {
      edge,
      px: e.clientX,
      py: e.clientY,
      x: note.x,
      y: note.y,
      w: note.w,
      h: paper.current?.offsetHeight ?? 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onRszMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = rsz.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (d.edge === "e") {
      const w = Math.min(Math.max(d.w + dx, MIN_W), window.innerWidth - EDGE - d.x);
      resizeStickyNote(note.id, d.x, d.y, Math.round(w), note.mh);
    } else if (d.edge === "w") {
      const w = Math.min(Math.max(d.w - dx, MIN_W), d.x + d.w - EDGE);
      resizeStickyNote(note.id, Math.round(d.x + d.w - w), d.y, Math.round(w), note.mh);
    } else if (d.edge === "s") {
      const h = Math.min(Math.max(d.h + dy, MIN_MH), window.innerHeight - TASKBAR - d.y);
      resizeStickyNote(note.id, d.x, d.y, note.w, Math.round(h));
    } else {
      const h = Math.min(Math.max(d.h - dy, MIN_MH), d.y + d.h - EDGE);
      resizeStickyNote(note.id, d.x, Math.round(d.y + d.h - h), note.w, Math.round(h));
    }
  };
  const onRszUp = () => {
    if (rsz.current) movedAt.current = Date.now();
    rsz.current = null;
  };

  const ringing = chimes.some((c) => c.noteId === note.id);
  const flashing = flash?.id === note.id;

  return (
    <div
      ref={paper}
      tabIndex={0}
      className={`pointer-events-auto absolute ${note.folded ? "px-[10px] py-[6px]" : "px-[10px] pt-[9px] pb-[8px]"} leading-[1.45] focus:outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-[#86806c] ${
        editing || note.folded ? "" : "select-none"
      } ${ringing ? "sticky-shake" : ""} ${flashing ? "sticky-flash" : ""}`}
      style={
        {
          left: note.x,
          top: note.y,
          width: note.w,
          height: note.folded ? FOLDED_H : undefined,
          minHeight: note.folded ? undefined : note.mh || undefined,
          "--tilt": `${deg}deg`,
          transform: `rotate(${deg}deg)`,
          background: sw.paper,
          boxShadow: `0 0 0 1px ${sw.frame}, 2px 3px 0 rgba(0,0,0,.18), 5px 7px 14px rgba(0,0,0,.22)`,
          color: TEXT,
          fontFamily: FONT,
          fontSize: note.size,
          touchAction: "none",
        } as CSSProperties
      }
      onPointerDown={onDown}
      onPointerMove={onDrag}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={onClickPaper}
      onContextMenu={onCtx}
      onKeyDown={onKey}
    >
      {/* Tape: the fold toggle. Half over the top edge, it reads as decoration
          until hovered; a folded scrap unfolds from anywhere on the strip.
          z-[2] keeps it and the delete ✕ above the north pull strip — the two
          live on the paper's top edge by design. */}
      <button
        type="button"
        aria-label={note.folded ? t("sticky.expandAria") : t("sticky.foldAria")}
        title={note.folded ? t("sticky.expand") : t("sticky.fold")}
        className="absolute left-1/2 top-[-8px] z-[2] h-[18px] w-[74px] -translate-x-1/2 rotate-[2deg] cursor-pointer bg-white/55 transition-colors hover:bg-white/80"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,.18)" }}
        onClick={(e) => {
          e.stopPropagation();
          toggleStickyFold(note.id);
        }}
      />
      <button
        type="button"
        aria-label={t("sticky.delete")}
        className="absolute right-[4px] top-[1px] z-[2] flex h-[14px] w-[14px] cursor-pointer items-center justify-center bg-transparent text-[10px] leading-none text-[#86806c] hover:text-[#b02020]"
        onClick={(e) => {
          e.stopPropagation();
          removeStickyNote(note.id);
        }}
      >
        ✕
      </button>
      {/* Edge pull strips; a rolled scrap only takes width pulls. */}
      {(["w", "e", "n", "s"] as const).map((edge) =>
        note.folded && (edge === "n" || edge === "s") ? null : (
          <div
            key={edge}
            className={`rsz absolute z-[1] ${EDGE_HIT[edge]}`}
            onPointerDown={(e) => startRsz(e, edge)}
            onPointerMove={onRszMove}
            onPointerUp={onRszUp}
            onPointerCancel={onRszUp}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      )}
      {note.folded ? (
        // Rolled scrap: a slim strip naming the note, todo progress at the tail.
        <div className="flex h-full items-center gap-[8px] overflow-hidden">
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold" style={{ color: TITLE }}>
            {stickyTitle(note.text, t("sticky.title"))}
          </span>
          {todos.length > 0 && (
            <span className="shrink-0 text-[10px]" style={{ color: SIG }}>
              {todos.filter((l) => l.kind === "todo" && l.done).length}/{todos.length}
            </span>
          )}
        </div>
      ) : editing ? (
        <textarea
          ref={area}
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(false)}
          onKeyDown={(e) => e.key === "Escape" && commit(true)}
          onPointerDown={(e) => e.stopPropagation()}
          className="block w-full resize-none overflow-hidden bg-transparent p-0 outline-none"
          style={{ color: TEXT, fontFamily: FONT, fontSize: note.size, lineHeight: 1.45, minHeight: 64 }}
        />
      ) : !note.text.trim() ? (
        <p className="m-0 italic" style={{ color: SIG }}>
          {t("sticky.write")}
        </p>
      ) : (
        parseStickyText(note.text).map((l, i) =>
          l.kind === "todo" ? (
            (() => {
              const timed = splitTodoTime(l.text);
              return (
                <p key={i} className="m-0 mb-[0.28em] flex items-start gap-[0.55em]">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={l.done}
                    aria-label={l.text || t("sticky.todo")}
                    className="mt-[0.18em] flex h-[1.02em] w-[1.02em] shrink-0 cursor-pointer items-center justify-center bg-transparent"
                    style={{ border: `1px solid ${l.done ? SIG : TEXT}` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStickyText(note.id, toggleStickyLine(note.text, i));
                    }}
                  >
                    {l.done && (
                      <span className="text-[0.84em] font-bold leading-none" style={{ color: SIG }}>
                        ✓
                      </span>
                    )}
                  </button>
                  <span
                    className={`min-w-0 flex-1 break-words ${l.done ? "line-through" : ""}`}
                    style={{ color: l.done ? SIG : TEXT }}
                  >
                    {(timed ? timed.body : l.text) || " "}
                    {timed && (
                      <span className="ml-[0.45em] text-[0.92em]" style={{ color: SIG, fontWeight: 700 }}>
                        @{timed.at}
                      </span>
                    )}
                  </span>
                </p>
              );
            })()
          ) : (
            <p key={i} className="m-0 mb-[0.46em] break-words">
              {l.title ? <b style={{ color: TITLE }}>{l.text}</b> : l.text || " "}
            </p>
          ),
        )
      )}
    </div>
  );
}
