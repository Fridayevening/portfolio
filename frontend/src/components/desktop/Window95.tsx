"use client";

import { useRef, type ReactNode, type PointerEvent as RPointerEvent } from "react";
import { useI18n } from "../../lib/i18n/LanguageContext";

// Corner-resize floor: any smaller and the titlebar / menu / status bar overlap.
const MIN_W = 280;
const MIN_H = 150;
// Taskbar height: dragging down must not bury the window's bottom edge under it.
const TASKBAR_H = 36;

// Corner handles straddle the corner point (half outside the window, half over the
// frame); the outside half keeps the top-right corner from covering the titlebar
// buttons — the hit area only grazes a 2px edge with them, clicks unaffected.
type Corner = "nw" | "ne" | "sw" | "se";
const CORNER_HANDLES: { corner: Corner; pos: React.CSSProperties }[] = [
  { corner: "nw", pos: { left: -6, top: -6, cursor: "nwse-resize" } },
  { corner: "ne", pos: { right: -6, top: -6, cursor: "nesw-resize" } },
  { corner: "sw", pos: { left: -6, bottom: -6, cursor: "nesw-resize" } },
  { corner: "se", pos: { right: -6, bottom: -6, cursor: "nwse-resize" } },
];

type Props = {
  title: string;
  icon: ReactNode;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  active: boolean;
  maximized: boolean;
  minimized: boolean;
  anchor?: "tr" | "br";
  canMinimize?: boolean;
  canMaximize?: boolean;
  /** Enables corner resizing; fixed windows like error dialogs omit it (defaults to false). */
  resizable?: boolean;
  onFocus: () => void;
  onClose: (btn: HTMLButtonElement | null) => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (x: number, y: number, w: number, h: number) => void;
  menu?: ReactNode;
  children: ReactNode;
};

export default function Window95(p: Props) {
  const { t } = useI18n();
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onTitleDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (p.maximized) return;
    if ((e.target as HTMLElement).closest("button")) return;
    const host = e.currentTarget.parentElement;
    if (!host) return;
    const r = host.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onTitleMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.dx;
    const ny = e.clientY - drag.current.dy;
    const minX = -(p.w - 80);
    const maxX = window.innerWidth - 80;
    const minY = 0;
    const maxY = window.innerHeight - 80;
    p.onMove(Math.min(Math.max(nx, minX), maxX), Math.min(Math.max(ny, minY), maxY));
  };
  const onTitleUp = () => {
    drag.current = null;
  };

  // ── Corner resize (same pointer-capture approach as the titlebar drag) ──
  // Measure the window's real geometry once at the start: anchored windows (anchor) are
  // positioned via right/bottom and their x/y state is decorative — resizing must be
  // based on the measured rect or the window jumps.
  const rz = useRef<{
    corner: Corner;
    px: number;
    py: number;
    bx: number;
    by: number;
    bw: number;
    bh: number;
  } | null>(null);

  const onCornerDown = (corner: Corner) => (e: RPointerEvent<HTMLDivElement>) => {
    if (p.maximized) return;
    const host = e.currentTarget.parentElement;
    if (!host) return;
    const r = host.getBoundingClientRect();
    rz.current = {
      corner,
      px: e.clientX,
      py: e.clientY,
      bx: r.left,
      by: r.top,
      bw: r.width,
      bh: r.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onCornerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = rz.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    // The dragged corner moves its two edges; the opposite corner stays pinned (dragging
    // nw pins the bottom-right in place).
    const right = s.bx + s.bw;
    const bottom = s.by + s.bh;
    let { bx: x, by: y, bw: w, bh: h } = s;
    if (s.corner.includes("e")) {
      w = Math.min(Math.max(s.bw + dx, MIN_W), window.innerWidth - s.bx);
    }
    if (s.corner.includes("s")) {
      h = Math.min(Math.max(s.bh + dy, MIN_H), window.innerHeight - TASKBAR_H - s.by);
    }
    if (s.corner.includes("w")) {
      x = Math.min(Math.max(s.bx + dx, Math.max(0, right - window.innerWidth)), right - MIN_W);
      w = right - x;
    }
    if (s.corner.includes("n")) {
      y = Math.min(Math.max(s.by + dy, 0), bottom - MIN_H);
      h = bottom - y;
    }
    p.onResize(x, y, w, h);
  };
  const onCornerUp = () => {
    rz.current = null;
  };

  const style: React.CSSProperties = p.maximized
    ? { left: 0, top: 0, width: "100%", height: "calc(100% - 36px)", zIndex: p.z }
    : p.anchor === "tr"
      ? { top: 12, right: 12, width: p.w, height: p.h, zIndex: p.z }
      : p.anchor === "br"
        ? { bottom: 44, right: 10, width: p.w, height: p.h, zIndex: p.z }
        : { left: p.x, top: p.y, width: p.w, height: p.h, zIndex: p.z };
  // Minimize hides, never unmounts: the program inside keeps its state (canvas,
  // audio graph, scroll, input) for the restore.
  if (p.minimized) style.display = "none";

  return (
    <section
      className="win95 absolute bg-chrome bevel-out flex flex-col p-[2px]"
      style={style}
      onPointerDown={p.onFocus}
    >
      <div
        className={`h-[22px] shrink-0 flex items-center gap-1 pl-1 pr-[2px] ${
          p.active ? "titlebar-active" : "titlebar-inactive"
        }`}
        style={{ touchAction: "none" }}
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleUp}
      >
        <span className="shrink-0 flex items-center">{p.icon}</span>
        <span className="flex-1 truncate text-[12px] font-bold text-white select-none">
          {p.title}
        </span>
        {p.canMinimize !== false && (
          <button aria-label={t("common.minimize")} className="winder" onClick={p.onMinimize}>
            ─
          </button>
        )}
        {p.canMaximize !== false && (
          <button aria-label={t("common.maximize")} className="winder" onClick={p.onToggleMaximize}>
            ▢
          </button>
        )}
        <button
          aria-label={t("common.close")}
          className="winder"
          onClick={(e) => p.onClose(e.currentTarget)}
        >
          ✕
        </button>
      </div>
      {p.menu}
      <div className="flex-1 min-h-0 m-[2px] mt-[1px] flex flex-col">{p.children}</div>
      {p.resizable &&
        !p.maximized &&
        CORNER_HANDLES.map((hd) => (
          <div
            key={hd.corner}
            className="absolute z-10 w-[12px] h-[12px]"
            style={{ ...hd.pos, touchAction: "none" }}
            aria-hidden
            onPointerDown={onCornerDown(hd.corner)}
            onPointerMove={onCornerMove}
            onPointerUp={onCornerUp}
            onPointerCancel={onCornerUp}
          />
        ))}
    </section>
  );
}
