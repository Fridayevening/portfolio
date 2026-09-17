"use client";

const ICON_W = 86;
const ICON_H = 70;
const NOTE_W = 232;
const NOTE_H = 66;
const GAP = 70;
const EDGE = 12;
const TASKBAR = 36;

const INK = "#253261";
const RED = "#b02020";
const SIG = "#4a5680";
const ARROW = "#1b3f8f";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export default function StickyNote({
  x,
  y,
  vw,
  vh,
}: {
  x: number;
  y: number;
  vw: number;
  vh: number;
}) {
  const atRight = x + ICON_W + GAP + NOTE_W + EDGE <= vw;
  const noteX = atRight ? x + ICON_W + GAP : x - NOTE_W - GAP;
  const noteY = clamp(y + ICON_H / 2 - NOTE_H / 2, EDGE, vh - TASKBAR - NOTE_H - EDGE);

  // Arrow geometry: a unit vector from the note's center toward the icon sprite's visual
  // center (y + 23 — the 43px sprite sits high in its 70px icon box). The path starts on
  // the note's near edge, ends 26px short of the icon, and its control point bows 22% of
  // the span to the side.
  const tx = x + ICON_W / 2;
  const ty = y + 23;
  const cx = noteX + NOTE_W / 2;
  const cy = noteY + NOTE_H / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / dist;
  const uy = dy / dist;
  const sx = cx + ux * (NOTE_W / 2 + 4) * (Math.abs(ux) > 0.5 ? 1 : 0.5);
  const sy = cy + uy * (NOTE_H / 2 + 4);
  const ex = tx - ux * 26;
  const ey = ty - uy * 26;
  const span = Math.hypot(ex - sx, ey - sy);
  const mx = (sx + ex) / 2 - uy * span * 0.22;
  const my = (sy + ey) / 2 + ux * span * 0.22;
  const ang = Math.atan2(ey - my, ex - mx);
  const a1x = ex - 11 * Math.cos(ang - 0.45);
  const a1y = ey - 11 * Math.sin(ang - 0.45);
  const a2x = ex - 11 * Math.cos(ang + 0.45);
  const a2y = ey - 11 * Math.sin(ang + 0.45);
  const f = (n: number) => n.toFixed(1);

  return (
    <div className="stickynote pointer-events-none absolute inset-0" aria-hidden>
      {span >= 26 && (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${vw} ${vh}`}
          fill="none"
          style={{ filter: "drop-shadow(1px 1px 0 rgba(0,0,0,.22))" }}
        >
          <path
            d={`M ${f(sx)} ${f(sy)} Q ${f(mx)} ${f(my)}, ${f(ex)} ${f(ey)}`}
            stroke={ARROW}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <path
            d={`M ${f(a1x)} ${f(a1y)} L ${f(ex)} ${f(ey)} L ${f(a2x)} ${f(a2y)}`}
            stroke={ARROW}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <div
        className="absolute px-[14px] pt-[14px] pb-[10px]"
        style={{
          left: noteX,
          top: noteY,
          width: NOTE_W,
          height: NOTE_H,
          color: INK,
          background: "linear-gradient(180deg, #fff3a1, #ffe97a 80%, #f4d95c)",
          fontFamily: '"Comic Sans MS", "Bradley Hand", "Segoe Print", cursive',
          fontSize: 16,
          lineHeight: 1.25,
          transform: "rotate(-5deg)",
          boxShadow: "2px 4px 0 rgba(0,0,0,.28), 8px 12px 18px rgba(0,0,0,.25)",
        }}
      >
        {/* Tape. */}
        <span
          className="absolute left-1/2 top-[-8px] h-[18px] w-[74px] -translate-x-1/2 rotate-[2deg] bg-white/55"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,.18)" }}
        />
        <p className="whitespace-nowrap">
          You may be here for <b className="underline" style={{ color: RED }}>this</b>!
        </p>
        <p className="mt-[6px] text-right text-[12px]" style={{ color: SIG }}>
          &mdash; just do it, <b style={{ color: INK }}>nike</b>
        </p>
      </div>
    </div>
  );
}
