"use client";

import {
  useRef,
  type KeyboardEvent as RKeyboardEvent,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";

export default function DesktopIcon({
  label,
  icon,
  selected,
  dimmed = false,
  x,
  y,
  onSelect,
  onOpen,
  onMove,
  onContextMenu,
  onRenameKey,
}: {
  /** String, or the inline rename input while renaming (doc 04 §5 icon phase). */
  label: ReactNode;
  icon: ReactNode;
  selected: boolean;
  /** Cut-clipboard visual: Win95 ghosts the icon awaiting paste. */
  dimmed?: boolean;
  /** Pixel position, or the percentage default of a scattered icon (once dragged,
   *  onMove reports pixels from then on). */
  x: number | string;
  y: number | string;
  onSelect: () => void;
  onOpen: () => void;
  onMove: (x: number, y: number) => void;
  onContextMenu?: (e: RMouseEvent<HTMLDivElement>) => void;
  /** F2 — start an inline rename (only wired for fs icons). */
  onRenameKey?: () => void;
}) {
  // Dragging uses the same pointer-capture approach as the Window95 title bar.
  const drag = useRef<{ px: number; py: number; dx: number; dy: number; moved: boolean } | null>(null);
  const movedAt = useRef(0);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    // No stopPropagation: clicks must still reach the desktop container so it can
    // close the start menu and deselect. The offset comes from the rendered rect —
    // default positions may be percentages, so props can't be subtracted directly.
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { px: e.clientX, py: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    // Movement under 4px reads as hand tremor, not a drag — leave it to click/dblclick.
    if (!d.moved) {
      if (Math.abs(e.clientX - d.px) < 4 && Math.abs(e.clientY - d.py) < 4) return;
      d.moved = true;
    }
    onMove(e.clientX - d.dx, e.clientY - d.dy);
  };
  const onUp = () => {
    if (drag.current?.moved) movedAt.current = Date.now();
    drag.current = null;
  };
  const onKey = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") onOpen();
    else if (e.key === " ") {
      // A native button fired click on Space (select); the div must keep that.
      e.preventDefault();
      onSelect();
    } else if (e.key === "F2") {
      e.preventDefault();
      onRenameKey?.();
    }
  };

  return (
    // role="button" div rather than <button>: the rename input must nest inside,
    // and interactive content may not nest in a button. Enter/Space are handled
    // by hand above to keep the keyboard contract.
    <div
      role="button"
      tabIndex={0}
      style={{ left: x, top: y, touchAction: "none" }}
      className={`dicon absolute w-[86px] flex flex-col items-center gap-[4px] p-[4px] cursor-default focus:outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-white ${
        dimmed ? "opacity-50" : ""
      }`}
      onPointerDown={onDown}
      onPointerMove={onDrag}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        // The click released right after a drag must not count toward a double-click.
        if (Date.now() - movedAt.current < 400) return;
        onOpen();
      }}
      onKeyDown={onKey}
      onContextMenu={onContextMenu}
    >
      <span className="relative block">
        {icon}
        {selected && (
          // The overlay must stay pointer-events-none: the second mousedown of a
          // double-click would land on it, and if a re-render unmounts it (deselection)
          // before mouseup, the browser drops both the click and the dblclick.
          <span className="pointer-events-none absolute inset-0 bg-navy/35 mix-blend-multiply" aria-hidden />
        )}
      </span>
      <span
        className={`text-[13px] leading-[1.2] text-white text-center px-[2px] max-w-full break-words ${
          selected ? "bg-navy" : ""
        }`}
        style={{ textShadow: "1px 1px 0 rgba(0,0,0,.8)" }}
      >
        {label}
      </span>
    </div>
  );
}
