"use client";

// Signal interference: every 30~40 s (jittered) the whole page glitches once, mimicking
// a failing TV. Mutually exclusive with the two easter eggs (melt / cola) and shutdown.
//
// How: crt-screen is rasterized into a frozen frame (snapshot.ts) and a same-size WebGL
// canvas takes over; the shader tears the frame apart TikTok-style — R/B channels
// pushed wide apart plus pure-red/pure-cyan ghosts. Amplitude follows an envelope +
// easing noise (wob, a few stacked sines): fast attack → wandering plateau → fast cut,
// occasionally with a small afterbeat. The bake runs on the main thread right before
// the episode, so it is kept lean (the SVG diet in snapshot.ts); if it can't finish
// within ~250 ms (cold cache), the episode is skipped rather than stalling the page —
// the caches come back warm for the next one.

import { useEffect, useRef, useState } from "react";
import { GlitchRenderer } from "./GlitchRenderer";
import { rasterizeElement, warmSnapshot } from "./snapshot";

// Parameters drawn at random for each episode.
type Fire = {
  sev: number; // 0.15..1
  durMs: number; // episode length in ms
  afterbeat: boolean; // small second peak near the end
  s: [number, number, number, number]; // seeds for the easing noise
};

// Canvas stage: the rect laid over crt-screen.
type Stage = { x: number; y: number; w: number; h: number; dw: number; dh: number };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
// Easing noise: a few sines at different frequencies/phases stacked, output ~[0,1],
// for a breathing feel.
const wob = (t: number, seed: number, f: number) =>
  0.5 +
  0.32 * Math.sin(t * f + seed) +
  0.12 * Math.sin(t * f * 2.61 + seed * 1.7) +
  0.06 * Math.sin(t * f * 5.3 + seed * 2.3);

const drawFire = (): Fire => {
  const r = Math.random();
  // Two in ten are mild (0.15~0.3); the rest land 0.35~1.
  const sev = r < 0.2 ? 0.15 + Math.random() * 0.15 : 0.35 + Math.random() * 0.65;
  const heavy = sev > 0.6;
  return {
    sev,
    // Duration and the 2.15× timescale are hand-tuned feel values; keep the rhythm
    // ratios if you touch them.
    durMs: (heavy ? 260 : 240) * (0.85 + Math.random() * 0.3),
    afterbeat: Math.random() < 0.15,
    s: [Math.random() * 9, Math.random() * 9, Math.random() * 9, Math.random() * 9],
  };
};

export default function SignalGlitch({ paused }: { paused: boolean }) {
  const [stage, setStage] = useState<Stage | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Tears down an episode interrupted mid-way (paused flips / unmount); null once it
  // finishes on its own.
  const abortRef = useRef<(() => void) | null>(null);
  // Whether at least one episode has fired: after an easter egg / shutdown lifts paused,
  // rescheduling must return to the regular interval (30~40 s) instead of the quick
  // first-fire window, which would chase right on the easter egg's tail.
  const firedRef = useRef(false);

  useEffect(() => {
    // Ambient decoration must not move at all.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Paused (easter egg / shutdown / repair mute): don't schedule. An in-flight episode
    // is torn down immediately by abortRef in the cleanup below; once paused lifts, the
    // regular interval from firedRef applies again.
    if (paused) return;
    // Prewarm the rasterizer's dependencies (CSS/fonts inlined as data URLs) while idle,
    // so the first episode doesn't fetch them on the spot.
    warmSnapshot();

    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let raf = 0;

    const arm = (fn: () => void, min: number, max: number) => {
      timer = setTimeout(() => {
        if (alive) fn();
      }, min + Math.random() * (max - min));
    };

    const fire = () => {
      if (document.hidden) {
        arm(fire, 1500, 5000);
        return;
      }
      firedRef.current = true;
      const el = document.querySelector<HTMLElement>(".crt-screen");
      if (!el) {
        armNext();
        return;
      }

      const f = drawFire();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = el.getBoundingClientRect();
      setStage({
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        dw: Math.round(rect.width * dpr),
        dh: Math.round(rect.height * dpr),
      });

      // —— Cleanup: restore everything, from whichever step we're torn out ——
      let renderer: GlitchRenderer | null = null;
      let done = false;
      const cleanup = () => {
        done = true;
        abortRef.current = null;
        cancelAnimationFrame(raf);
        renderer?.dispose();
        renderer = null;
        document.body.classList.remove("glitching");
        const cv = canvasRef.current;
        if (cv) cv.classList.remove("is-live");
        setStage(null);
      };
      abortRef.current = cleanup;

      // —— Bake the frozen frame, then hand the canvas over (interruptible while async) ——
      void (async () => {
        // The bake shares the main thread; ~250 ms is the budget. Over it (cold cache
        // on a first visit) the episode is skipped — an invisible skip beats stalling
        // the page. The losing bake keeps running and warms the caches either way.
        const raster = await Promise.race([
          rasterizeElement(el, 1),
          new Promise<null>((r) => setTimeout(() => r(null), 250)),
        ]);
        // Interrupted (done) = paused / unmount; the effect takes over from here — don't
        // arm the next episode.
        if (done) return;
        if (!raster) {
          cleanup();
          armNext();
          return;
        }
        // The setStage canvas only mounts after React commits — during the bake, in
        // practice; wait it out just in case.
        let cv = canvasRef.current;
        for (let i = 0; !cv && i < 6; i++) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          cv = canvasRef.current;
        }
        if (done) return;
        if (!cv) {
          cleanup();
          armNext();
          return;
        }
        try {
          renderer = new GlitchRenderer(cv, Math.random() * 100);
          renderer.setPicture(raster);
        } catch {
          cleanup();
          armNext();
          return;
        }

        cv.classList.add("is-live");
        document.body.classList.add("glitching");

        const t0 = performance.now();
        const tick = (now: number) => {
          if (done) return;
          raf = requestAnimationFrame(tick);
          if (!renderer) return;
          const t = (now - t0) / 1000;
          const ts = t * 2.35; // 2.15× speed: shader evolution and amplitude breathing share this timeline
          const p = (now - t0) / f.durMs;

          // Master envelope: fast attack → plateau → fast cut (~10% of the duration
          // each — a TV fault snaps in and out); the afterbeat adds a small second peak
          // around 0.86. The whole look is the TikTok-style split: R/B pushed apart +
          // red/cyan ghosts. Snow, row fray and vertical jitter were retired on
          // feedback. Audio untouched (the player keeps singing).
          const env = Math.min(
            1,
            smoothstep(0.02, 0.12, p) * (1 - smoothstep(0.78, 0.94, p)) +
              (f.afterbeat
                ? smoothstep(0.855, 0.875, p) * (1 - smoothstep(0.925, 0.95, p)) * 0.25
                : 0),
          );
          renderer.draw({
            time: ts,
            env,
            tear: 0,
            chroma: (0.4 + 1.3 * f.sev) * env * (0.6 + 0.4 * wob(ts, f.s[1], 1.9)),
            // TikTok-style chroma aberration: R/B pushed wide apart + pure-red/pure-cyan
            // ghosts; restrained overall (peak ~12px).
            split: (2 + 9 * f.sev) * env * (0.6 + 0.4 * wob(ts, f.s[1] + 4, 1.6)),
            ghost: (0.1 + 0.2 * f.sev) * env,
            snow: 0,
            vjit: 0,
            roll: 0,
          });

          if (p >= 1) {
            cleanup();
            armNext();
          }
        };
        // Draw frame 0 synchronously: waiting for the first rAF would leave one blank
        // frame between is-live and the first draw. tick arms the next rAF itself.
        tick(performance.now());
      })();
    };

    const armNext = () => {
      // Rest a little longer after a big episode; the window floats over 30~40 s.
      const extra = Math.random() < 0.2 ? 3000 : 0;
      arm(fire, 30000 + extra, 40000 + extra);
    };

    // First episode comes early (3.5~8 s) so a visitor runs into one; rescheduling after
    // an easter-egg / shutdown interruption uses the regular interval.
    if (firedRef.current) arm(fire, 30000, 40000);
    else arm(fire, 3500, 8000);

    return () => {
      alive = false;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      abortRef.current?.();
    };
  }, [paused]);

  return (
    <>
      {stage && (
        <canvas
          ref={canvasRef}
          className="glitch-fx"
          style={{ left: stage.x, top: stage.y, width: stage.w, height: stage.h }}
          width={stage.dw}
          height={stage.dh}
          aria-hidden
        />
      )}
    </>
  );
}
