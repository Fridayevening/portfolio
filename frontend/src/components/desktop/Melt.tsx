"use client";

// Lemonade easter egg: the whole page melts, then time rewinds to restore it.
// Visuals: feTurbulence/feDisplacementMap organic warp + sag + drips + puddle.
// Recovery is not a hard cut: when the countdown hits zero, every melt animation is
// reversed (WAAPI reverse) and started staggered by "the mirror of its end time" — the
// page un-melts frame for frame exactly the way it melted.

import { useEffect, useMemo, useRef, useState } from "react";

export const MELT_SECONDS = 10;

/** Rewind multiplier: the reversal collects itself in ~1 s, keeping double-click to
 *  restored within 11.5 s (mirror order untouched). */
const REWIND_SPEED = 10;

/** Globally resident filter defs. Must live outside the melted subtree (under Desktop's
 *  root div). */
export function MeltDefs() {
  return (
    <svg aria-hidden className="absolute h-0 w-0 overflow-hidden">
      <defs>
        <filter id="melt-warp" x="-10%" y="-10%" width="120%" height="130%">
          <feTurbulence
            id="melt-noise"
            type="fractalNoise"
            baseFrequency="0.012 0.026"
            numOctaves="2"
            seed="8"
            result="n"
          />
          <feDisplacementMap
            id="melt-disp"
            in="SourceGraphic"
            in2="n"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

// Drop colors: the lemon-yellow family plus a hint of desktop teal — reads as
// "lemonade flooding the machine".
const DROP_COLORS = ["#ffe36e", "#ffd23f", "#fce97c", "#8fd9c9", "#f0e13a"];

type Drop = {
  left: number; // %
  size: number; // px
  delay: number; // s
  dur: number; // s
  color: string;
};

type Phase = "melt" | "rewind";

// Name only the melt animations; infinitely-looping ambient ones (crt-flicker/EQ/LED)
// must never be reversed.
const MELT_ANIMS = new Set(["melt-sag", "melt-drip", "melt-puddle", "melt-drop"]);

function animName(a: Animation): string | undefined {
  return (a as unknown as { animationName?: string }).animationName;
}

/**
 * Melt stage: HUD countdown + drips + bottom puddle + rAF displacement driving.
 * Mounted only while active; when the melt countdown runs out it enters the rewind
 * phase, and onDone fires only after every animation has played backwards — the parent
 * then removes the whole mode.
 */
export function MeltStage({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("melt");
  const [remain, setRemain] = useState(MELT_SECONDS);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const rewindTotal = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Melt phase: 100 ms countdown steps; the HUD shows one decimal.
  useEffect(() => {
    if (phase !== "melt") return;
    const t0 = performance.now();
    const iv = setInterval(() => {
      const left = Math.max(0, MELT_SECONDS - (performance.now() - t0) / 1000);
      setRemain(left);
      if (left > 0) return;
      clearInterval(iv);
      // Time rewind: every melt animation reverses, accelerated to REWIND_SPEED ×.
      // Each animation starts rewinding only after (total duration − its own end time)
      // / speed, so the whole thing is strictly the melt film played backwards (what
      // melted last un-melts first) — just with the projector running faster.
      const anims = document.getAnimations().filter((a) => {
        const n = animName(a);
        return n !== undefined && MELT_ANIMS.has(n);
      });
      let T = 0;
      for (const a of anims) T = Math.max(T, Number(a.effect?.getComputedTiming().endTime ?? 0) || 0);
      rewindTotal.current = T / 1000 / REWIND_SPEED;
      if (T <= 0) {
        // (reduced-motion: no animations to orchestrate) treat recovery as done.
        doneRef.current();
        return;
      }
      const rewindOne = (a: Animation) => {
        a.reverse(); // makes it start from the right position (the end frame)
        a.playbackRate = -REWIND_SPEED; // and speeds the reversal up
      };
      timersRef.current = anims
        .map((a) => {
          const wait = (T - (Number(a.effect?.getComputedTiming().endTime ?? 0) || 0)) / REWIND_SPEED;
          if (wait <= 0) {
            rewindOne(a);
            return null;
          }
          return setTimeout(() => rewindOne(a), wait);
        })
        .filter((t): t is ReturnType<typeof setTimeout> => t !== null);
      setPhase("rewind");
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);

  // Rewind phase: HUD counts down from the total rewind time (0.3 s of slack at the end
  // catches late timers).
  useEffect(() => {
    if (phase !== "rewind") return;
    const total = Math.max(rewindTotal.current, 0.1) + 0.3;
    const t0 = performance.now();
    const iv = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - t0) / 1000);
      setRemain(left);
      if (left <= 0) {
        clearInterval(iv);
        doneRef.current();
      }
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);

  // Clear rewind timers that never got their turn on unmount.
  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  // Eases the displacement scale up / back down (viscous feel: pushed once every 3
  // frames, not chasing the full 60fps). The rewind curve mirrors the melt curve.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const disp = document.getElementById("melt-disp");
    if (!disp) return;
    // Melt ramps to 130 over 9.6 s; rewind compresses that by the multiplier — the two
    // curves meet at 130.
    const DUR = phase === "melt" ? 9600 : 9600 / REWIND_SPEED;
    const t0 = performance.now();
    let n = 0;
    let raf = 0;
    const tick = (t: number) => {
      if (n++ % 3 === 0) {
        const p = Math.min((t - t0) / DUR, 1);
        const v = phase === "melt" ? p * p : (1 - p) * (1 - p);
        disp.setAttribute("scale", String(Math.round(v * 130)));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      disp.setAttribute("scale", "0");
    };
  }, [phase]);

  // Drips: generated once, each falls with its own delay.
  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: 16 }, () => ({
        left: 3 + Math.random() * 94,
        size: 5 + Math.random() * 9,
        delay: 0.2 + Math.random() * 7.8,
        dur: 1.4 + Math.random() * 1.1,
        color: DROP_COLORS[(Math.random() * DROP_COLORS.length) | 0],
      })),
    [],
  );

  return (
    <>
      <div className="melt-hud" role="status">
        <span className="melt-hud-dot" aria-hidden />
        {phase === "melt" ? "I'll make it LEMONADE.EXE" : "I'll make it LEMONADE.EXE"} · {remain.toFixed(1)}s
      </div>

      {drops.map((d, i) => (
        <span
          key={i}
          className="melt-drop"
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size * 1.35,
            background: d.color,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
          aria-hidden
        />
      ))}

      <div className="melt-puddle" aria-hidden />
    </>
  );
}
