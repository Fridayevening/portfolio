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
  INKS,
  clearPendingEdit,
  copyDeskText,
  moveDeskText,
  peekPendingEdit,
  removeDeskText,
  resetDeskSize,
  restoreDeskTexts,
  rotateDeskText,
  setDeskFont,
  setDeskText,
  stepDeskSize,
  textMeasured,
  toggleDeskTop,
  useDeskTexts,
  type DeskTextData,
} from "./deskTextState";
import { useI18n } from "../../lib/i18n/LanguageContext";

// Default look: white words on the navy selection box, dotted white frame —
// text caught mid-"select all" on the desk. Both presets share the box; the
// chrome (bg/border/padding) lives on the item container, p and textarea both
// sit inside it, so the editor stays pixel-identical to the render.
const TASKBAR = 36;
const EDGE = 4;
const BOX_CHROME = { background: "var(--navy)", border: "1px dotted #fff", padding: "5px 8px" };
const FONT =
  'Tahoma, "MS Sans Serif", Geneva, Verdana, "PingFang SC", "Microsoft YaHei", sans-serif';
// Title preset — the rave-flyer look, minus the outline/drop it wore when the
// letters floated bare on the wallpaper: Pixelify Sans carries Latin, Fusion
// Pixel 12px (its CJK face loads on first use) carries the hanzi with a
// dot-matrix song flavor.
const TITLE_FONT =
  '"Pixelify Sans", "Fusion Pixel 12px Proportional SC", Tahoma, "PingFang SC", "Microsoft YaHei", sans-serif';
const TITLE_WEIGHT = 700;

export default function DeskTexts() {
  const texts = useDeskTexts();
  useEffect(() => {
    restoreDeskTexts();
    // The spawn-to-edit slot only ever applies to items mounting after a
    // spawn; by layer-mount time it can only be a stale leftover.
    clearPendingEdit();
  }, []);
  // Both layers are pass-through sheets; only the items take pointer events.
  // The pinned sheet sits over every window and chrome peer (taskbar 850,
  // start menu 860, paperclip 865), under the error-storm dialogs (≤896) and
  // the CRT raster (900) — the scanlines press on everything on the tube.
  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[12]">
        {texts
          .filter((t) => !t.top)
          .map((t) => (
            <DeskTextItem key={t.id} text={t} />
          ))}
      </div>
      <div className="pointer-events-none absolute inset-0 z-[870]">
        {texts
          .filter((t) => t.top)
          .map((t) => (
            <DeskTextItem key={t.id} text={t} />
          ))}
      </div>
    </>
  );
}

function DeskTextItem({ text: t }: { text: DeskTextData }) {
  const { t: tr } = useI18n();
  // A fresh spawn mounts straight into the editor: the initial state (not an
  // effect) reads the store's idempotent peek slot, so StrictMode's double
  // initializer run can't consume it out from under the item.
  const [editing, setEditing] = useState(() => peekPendingEdit() === t.id);
  const [draft, setDraft] = useState(t.text);
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const menu = useContextMenu();
  // Same capture-drag scheme as DesktopIcon; the live rect carries the clamp
  // size, which the store only caches between ResizeObserver ticks.
  const drag = useRef<{ px: number; py: number; dx: number; dy: number; w: number; h: number; moved: boolean } | null>(
    null,
  );
  const movedAt = useRef(0);

  const ink = INKS[t.ink] ?? INKS[0];
  const title = t.font === "title";

  const startEdit = () => {
    setDraft(t.text);
    setEditing(true);
  };
  // A blank commit removes the item: bare text has no visual placeholder, so
  // an empty text must not linger as an invisible hit box. refocus: Escape
  // keeps the user on the item (⌘/Ctrl +/- stays live); a blur commit means
  // they clicked away and must not have focus yanked back. The commit also
  // retires the spawn-to-edit slot: pin toggles remount the item, and a live
  // slot would reopen the editor on every remount.
  const commit = (refocus: boolean) => {
    setEditing(false);
    clearPendingEdit();
    if (draft.trim() === "") {
      removeDeskText(t.id);
      return;
    }
    if (draft !== t.text) setDeskText(t.id, draft);
    if (refocus) box.current?.focus();
  };
  // Font zoom, scoped to the focused item — same contract as the sticky notes.
  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (editing) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      startEdit();
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "=" || e.key === "+" || e.key === "Add") {
      e.preventDefault();
      stepDeskSize(t.id, 1);
    } else if (e.key === "-" || e.key === "_" || e.key === "Subtract") {
      e.preventDefault();
      stepDeskSize(t.id, -1);
    } else if (e.key === "0") {
      e.preventDefault();
      resetDeskSize(t.id);
    }
  };

  // Enter-edit only: focus and park the caret at the end; per keystroke this
  // would drag mid-text typing back to the tail.
  useEffect(() => {
    if (!editing || !area.current) return;
    const el = area.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);
  // Shrink-to-fit both axes of the no-wrap editor so it overlays the rendered
  // text exactly. width must pass through 0 first: "auto" falls back to the
  // cols default, scrollWidth alone doesn't shrink below it.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.width = "0px";
    el.style.height = "0px";
    el.style.width = `${el.scrollWidth + 1}px`;
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  // Live footprint cache for the store's viewport clamp (in-memory, no emit).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => textMeasured(t.id, el.offsetWidth, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.id]);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (editing) return;
    // Grab offsets are taken against the stored x/y, not the rect: a rotated
    // item's rect is its axis-aligned bounding box, whose offset would leak
    // into every drag and leave the text trailing the cursor. The rect is
    // still measured — the rotated footprint is what must stay on screen.
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { px: e.clientX, py: e.clientY, dx: e.clientX - t.x, dy: e.clientY - t.y, w: r.width, h: r.height, moved: false };
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
    moveDeskText(t.id, Math.round(x), Math.round(y));
  };
  const onUp = () => {
    if (drag.current?.moved) movedAt.current = Date.now();
    drag.current = null;
  };
  const onClickItem = () => {
    if (editing) return;
    // The click released right after a drag must not open the editor.
    if (Date.now() - movedAt.current < 400) return;
    startEdit();
  };
  const onCtx = (e: RMouseEvent<HTMLDivElement>) => {
    // While editing, right-clicks stay suppressed (no caret menu on this site).
    if (editing) return;
    menu.open(e, [
      { kind: "item", label: tr("sticky.edit"), action: startEdit },
      {
        kind: "item",
        label: tr("deskText.font"),
        sub: (["body", "title"] as const).map((f) => ({
          kind: "item" as const,
          label: f === "body" ? tr("deskText.hand") : tr("deskText.title"),
          icon: (
            <span
              className="text-[13px] leading-none"
              style={f === "body" ? { fontFamily: FONT } : { fontFamily: TITLE_FONT, fontWeight: TITLE_WEIGHT }}
            >
              Aa
            </span>
          ),
          disabled: t.font === f,
          action: () => setDeskFont(t.id, f),
        })),
      },
      {
        kind: "item",
        label: tr("deskText.rotate"),
        sub: [
          { kind: "item" as const, label: tr("deskText.left"), action: () => rotateDeskText(t.id, -5) },
          { kind: "item" as const, label: tr("deskText.right"), action: () => rotateDeskText(t.id, 5) },
          { kind: "item" as const, label: tr("deskText.reset"), disabled: t.deg === 0, action: () => rotateDeskText(t.id, -t.deg) },
        ],
      },
      {
        kind: "item",
        label: t.top ? tr("deskText.unpin") : tr("deskText.pin"),
        action: () => toggleDeskTop(t.id),
      },
      { kind: "item", label: tr("deskText.grow"), action: () => stepDeskSize(t.id, 1) },
      { kind: "item", label: tr("deskText.shrink"), action: () => stepDeskSize(t.id, -1) },
      { kind: "sep" },
      { kind: "item", label: tr("deskText.copy"), action: () => copyDeskText(t.id) },
      { kind: "item", label: tr("deskText.delete"), danger: true, action: () => removeDeskText(t.id) },
    ]);
  };

  // One style object feeds both the rendered <p> and the editor textarea, so
  // the two presets only differ through these fields.
  const shared = title
    ? {
        color: ink.color,
        fontFamily: TITLE_FONT,
        fontWeight: TITLE_WEIGHT,
        fontSize: t.size,
        lineHeight: 1.15,
      }
    : { color: ink.color, fontFamily: FONT, fontSize: t.size, lineHeight: 1.4 };

  return (
    <div
      ref={box}
      role="button"
      tabIndex={0}
      aria-label={t.text.trim().slice(0, 24) || tr("deskText.label")}
      className={`pointer-events-auto absolute w-fit cursor-default touch-none focus:outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-white/60 ${
        editing ? "" : "select-none"
      }`}
      style={
        {
          left: t.x,
          top: t.y,
          transform: t.deg ? `rotate(${t.deg}deg)` : undefined,
          ...BOX_CHROME,
          ...(editing ? { outline: "1px dotted rgba(255,255,255,.45)", outlineOffset: 3 } : {}),
        } as CSSProperties
      }
      onPointerDown={onDown}
      onPointerMove={onDrag}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={onClickItem}
      onContextMenu={onCtx}
      onKeyDown={onKey}
    >
      {editing ? (
        <textarea
          ref={area}
          value={draft}
          spellCheck={false}
          wrap="off"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(false)}
          onKeyDown={(e) => e.key === "Escape" && !e.nativeEvent.isComposing && commit(true)}
          onPointerDown={(e) => e.stopPropagation()}
          className="block resize-none overflow-hidden bg-transparent p-0 outline-none whitespace-pre"
          style={{ ...shared, minWidth: 28 }}
        />
      ) : (
        <p className="m-0 whitespace-pre" style={shared}>
          {t.text || " "}
        </p>
      )}
    </div>
  );
}
