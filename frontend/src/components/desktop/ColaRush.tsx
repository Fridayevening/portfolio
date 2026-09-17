"use client";

// Cola easter egg: sugar rush → caffeine crash → recovery.
// Lemonade warps space (melt); cola warps time: every animation on the site sprints at
// ×6 at once (EQ thrashing, flicker strobing, the paperclip twitching), even the media
// player's song goes chipmunk; when the rush ends everything drops into ×0.05 slow
// motion + grayscale (caffeine crash, the song sinks to demon bass), then it all comes
// back. Mechanism nods to Melt's document.getAnimations() trick, but changes
// playbackRate instead of reversing.

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../../lib/i18n/LanguageContext";

export const RUSH_SECONDS = 8;
export const CRASH_SECONDS = 4;

const RUSH_SPEED = 6;
const CRASH_SPEED = 0.05;
// Songs change speed on their own gentler tier, shifting pitch along the way
// (preservesPitch=false): rush = keyed-up in a higher key, crash = low and slow —
// either way the song stays listenable.
const RUSH_AUDIO = 1.6;
const CRASH_AUDIO = 0.5;
const RECOVER_MS = 700; // recovery: rates restored + filter faded out, then unmount
const GHOST_MIN_GAP = 35; // min ghost spacing (ms); denser smears into a blur
const GHOST_LIFE = 650; // ghost lifetime, kept in step with rush-ghost-fade

// Ghost graphic: the Win95 white arrow, black outline (ghosts flash by — close enough).
const CURSOR_SVG =
  '<svg width="15" height="20" viewBox="0 0 8 12" shape-rendering="crispEdges" aria-hidden="true"><path d="M0.6 0.6 L0.6 9.4 L2.8 7.2 L4.2 10.6 L5.6 10 L4.3 6.7 L6.9 6.6 Z" fill="#ffffff" stroke="#0a0a0a" stroke-width="0.7"/></svg>';

export type RushPhase = "rush" | "crash";
type Phase = RushPhase | "recover";

// Our own material (HUD / speed lines) must never be sped up or frozen — excluded by
// animationName prefix.
function isOwnAnimation(a: Animation): boolean {
  const n = (a as unknown as { animationName?: string }).animationName;
  return n !== undefined && n.startsWith("rush-");
}

export default function ColaRush({
  onPhase,
  onDone,
}: {
  /** Phase changes are mirrored to Desktop so it can swap the filter class (the
   *  initial "rush" is set directly by the entry point, not via this callback). */
  onPhase: (p: RushPhase | null) => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("rush");
  const [remain, setRemain] = useState(RUSH_SECONDS);
  // Retouched animations → their original rate; recovery writes them back unchanged
  // (Melt plays backwards, this restores).
  const touched = useRef<Map<Animation, number>>(new Map());
  const audioRate = useRef<number | null>(null);
  const audioPitch = useRef<boolean | null>(null);
  const ghostHost = useRef<HTMLDivElement>(null);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setRate = useCallback(
    (animRate: number, songRate: number) => {
      // Under reduced-motion there are no animations to orchestrate, and we leave the
      // song alone too — filter and HUD only.
      if (reduceMotion) return;
      for (const a of document.getAnimations()) {
        if (isOwnAnimation(a)) continue;
        if (!touched.current.has(a)) touched.current.set(a, a.playbackRate);
        a.playbackRate = animRate;
      }
      const audio = document.querySelector("audio");
      if (audio) {
        if (audioRate.current === null) {
          audioRate.current = audio.playbackRate;
          audioPitch.current = audio.preservesPitch;
        }
        audio.preservesPitch = false; // speed change with pitch: keyed-up high / low and slow
        audio.playbackRate = songRate;
      }
    },
    [reduceMotion],
  );

  const restore = useCallback(() => {
    // Mutates Web Animations / DOM object properties, not React state.
    // eslint-disable-next-line react-hooks/immutability
    for (const [a, r] of touched.current) a.playbackRate = r;
    touched.current.clear();
    const audio = document.querySelector("audio");
    if (audio && audioRate.current !== null) {
      audio.playbackRate = audioRate.current;
      audioRate.current = null;
      if (audioPitch.current !== null) audio.preservesPitch = audioPitch.current;
      audioPitch.current = null;
    }
  }, []);

  // State machine: rush countdown → crash countdown → recover. Rates are re-applied
  // every 500 ms so animations appearing mid-flight (tip, EQ remounts, …) get pulled
  // into the rhythm too.
  useEffect(() => {
    if (phase === "recover") {
      restore();
      onPhase(null);
      const t = setTimeout(onDone, RECOVER_MS);
      return () => clearTimeout(t);
    }
    const total = phase === "rush" ? RUSH_SECONDS : CRASH_SECONDS;
    const rate = phase === "rush" ? [RUSH_SPEED, RUSH_AUDIO] : [CRASH_SPEED, CRASH_AUDIO];
    if (phase === "crash") onPhase("crash"); // "rush" was already set by Desktop's entry
    setRate(rate[0], rate[1]);
    const t0 = performance.now();
    const iv = setInterval(() => {
      const left = Math.max(0, total - (performance.now() - t0) / 1000);
      setRemain(left);
      if (left > 0) return;
      clearInterval(iv);
      if (phase === "rush") {
        setRemain(CRASH_SECONDS);
        setPhase("crash");
      } else {
        setPhase("recover");
      }
    }, 100);
    const keep = setInterval(() => setRate(rate[0], rate[1]), 500);
    return () => {
      clearInterval(iv);
      clearInterval(keep);
    };
  }, [phase, setRate, restore, onPhase, onDone]);

  // Unmount insurance: torn out of any phase (including an early unmount by a parent),
  // rates are always restored.
  useEffect(() => () => restore(), [restore]);

  // Cursor ghosts: during the rush the pointer leaves a trail of fading arrows (cloning
  // that cocaine-jitter feel). Nodes are used and discarded (spans are small and
  // short-lived — pooling isn't worth it); the layer unmounts at crash, ghosts go with
  // their animations.
  useEffect(() => {
    if (phase !== "rush" || reduceMotion) return;
    const host = ghostHost.current;
    if (!host) return;
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - last < GHOST_MIN_GAP) return;
      last = now;
      const g = document.createElement("span");
      g.className = "rush-ghost";
      g.style.left = `${e.clientX}px`;
      g.style.top = `${e.clientY}px`;
      g.innerHTML = CURSOR_SVG;
      host.appendChild(g);
      setTimeout(() => g.remove(), GHOST_LIFE + 60);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [phase, reduceMotion]);

  return (
    <>
      <div className={`rush-hud${phase === "crash" ? " is-crash" : ""}`} role="status">
        <span className="rush-hud-dot" aria-hidden />
        {phase === "rush"
          ? `SUGAR_RUSH.EXE · ${remain.toFixed(1)}s`
          : phase === "crash"
            ? `CAFFEINE CRASH · ${remain.toFixed(1)}s`
            : t("cola.recovering")}
      </div>
      {phase === "rush" && <div className="rush-lines" aria-hidden />}
      {phase === "rush" && <div className="rush-redglow" aria-hidden />}
      {phase === "rush" && <div ref={ghostHost} className="absolute inset-0 z-[9998] pointer-events-none" aria-hidden />}
    </>
  );
}
