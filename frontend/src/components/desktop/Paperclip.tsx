"use client";

// Paperclip desk pet.
//
// Behavior: lives on the desktop permanently and never leaves; occasionally pops a
// bubble to say something (first time 10–16 s, then random 45–110 s), typewriter-style,
// and the bubble folds itself away when done; clicking the body switches to the next
// line, ✕ folds the bubble and postpones the next one; draggable (same technique as
// desktop icons). When the lemonade melt starts it cuts in with melt lines and drips
// down along with .mode-melt. The rewind recovery is covered automatically by Melt.tsx's
// global scan — zero cooperation needed here.
//
// The three-level nesting is deliberate: `animation` is a single property and melt-drip
// occupies the root layer's slot; if the entrance animation also lived on the root,
// removing mode-melt after the rewind would re-resolve clip-enter and replay it (the
// pet would bounce again after recovery). The root layer never carries an animation;
// the entrance lives on the child layer, the idle sway in the innermost — still
// swaying while it melts.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as RPointerEvent,
} from "react";
import { useI18n } from "../../lib/i18n/LanguageContext";
import type { DictKey } from "../../lib/i18n/dict";

type Pool = "idle" | "melt";

// Persona: an eager and entirely useless assistant.
const LINES_IDLE: DictKey[] = [
  "clip.using",
  "clip.help",
  "clip.clueless",
  "clip.dblclick",
  "clip.tidied",
  "clip.oldNews",
  "clip.player",
  "clip.mouse",
  "clip.melt",
  "clip.noHelp",
  "clip.blink",
  "clip.delete",
  "clip.precursor",
  "clip.waiting",
];

const LINES_MELT: DictKey[] = [
  "clip.plan",
  "clip.mop",
  "clip.normal",
  "clip.lick",
  "clip.dry",
];

const lastPick: Record<Pool, number> = { idle: -1, melt: -1 };
function pick(pool: Pool): DictKey {
  const lines = pool === "idle" ? LINES_IDLE : LINES_MELT;
  let i = Math.floor(Math.random() * lines.length);
  if (i === lastPick[pool]) i = (i + 1) % lines.length; // no immediate repeats
  lastPick[pool] = i;
  return lines[i];
}

const W = 60;
const H = 84;
const TASKBAR = 36;

const BODY_PATH = "M18 30 v30 a12 12 0 0 0 24 0 V22 a9 9 0 0 0 -18 0 v34 a5 5 0 0 0 10 0 V30";

type Pos = { x: number; y: number; tailRight: boolean };

function placeAt(vw: number, vh: number, x: number, y: number): Pos {
  return {
    x: Math.min(Math.max(x, 0), vw - W),
    y: Math.min(Math.max(y, 0), vh - TASKBAR - H), // never overlaps the taskbar
    tailRight: x >= vw / 2,
  };
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export default function Paperclip({ melt }: { melt: boolean }) {
  const { t } = useI18n();
  const [pool, setPool] = useState<Pool>("idle");
  const [line, setLine] = useState("");
  const [typed, setTyped] = useState(0);
  const [pos, setPos] = useState<Pos | null>(null);
  const noMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const schedRef = useRef<number | null>(null);
  const penaltyRef = useRef(1);
  const prevMeltRef = useRef(false);
  const drag = useRef<{ px: number; py: number; dx: number; dy: number; moved: boolean } | null>(null);
  const movedAt = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pupilL = useRef<SVGGElement | null>(null);
  const pupilR = useRef<SVGGElement | null>(null);

  const done = line.length > 0 && (noMotion || typed >= line.length);

  // Placement: a bit right of bottom-center, above the taskbar; resize clamps back
  // into the viewport.
  useEffect(() => {
    setPos(
      placeAt(
        window.innerWidth,
        window.innerHeight,
        Math.round(window.innerWidth / 2) + 40,
        window.innerHeight - TASKBAR - H - 14,
      ),
    );
    const onResize = () => {
      setPos((p) => (p ? placeAt(window.innerWidth, window.innerHeight, p.x, p.y) : p));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Single entry point for switching lines.
  const say = useCallback((p: Pool) => {
    setPool(p);
    setLine(t(pick(p)));
    setTyped(0);
  }, [t]);

  // Speaking schedule (the body is permanent; only the bubble opens and closes). Hidden
  // tabs don't burn turn counts: if the timer comes due while document.hidden, the due
  // time is pushed back and re-armed on visibilitychange with the remaining duration.
  useEffect(() => {
    if (line) return; // bubble open (mid melt-line too) — nothing to schedule
    const now = Date.now();
    if (schedRef.current === null) {
      schedRef.current = now + 10_000 + Math.random() * 6_000; // first turn 10–16 s
    } else if (schedRef.current <= now) {
      schedRef.current = now + (45_000 + Math.random() * 65_000) * penaltyRef.current;
      penaltyRef.current = 1;
    }
    // else: previous turn not due yet (StrictMode re-run / hot reload) — keep the schedule.
    let t: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      t = null;
      if (document.hidden) {
        schedRef.current = Date.now() + 1500;
        return;
      }
      say("idle");
    };
    t = setTimeout(fire, Math.max(0, schedRef.current - now));
    const onVis = () => {
      if (document.hidden) {
        if (t) clearTimeout(t);
        t = null; // hidden: only drop the timer; schedule progress stays in schedRef
      } else if (t === null) {
        t = setTimeout(fire, Math.max(1500, (schedRef.current ?? Date.now()) - Date.now()));
      }
    };
    window.addEventListener("visibilitychange", onVis);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("visibilitychange", onVis);
    };
  }, [line, say]);

  // Typewriter: only advances; resetting on line change happens in say/click (above).
  // Once full, the interval ticks are same-value no-ops React skips rendering — never
  // clearInterval inside the updater (side effects are banned there under StrictMode);
  // it lives until the next line change.
  useEffect(() => {
    if (!line || noMotion) return;
    const t = setInterval(() => setTyped((n) => Math.min(n + 1, line.length)), 45);
    return () => clearInterval(t);
  }, [line, noMotion]);

  // Dwell after the line finishes. While melting the fold is frozen: commentate the
  // whole way, never clam up halfway. Folding unmounts only the bubble — the body
  // stays, and an in-flight drag's pointer capture is untouched.
  useEffect(() => {
    if (!done || melt) return;
    const t = setTimeout(() => setLine(""), 4200 + line.length * 90);
    return () => clearTimeout(t);
  }, [done, melt, line]);

  // Melt rising edge: cut in with a line immediately; the falling edge (melt over)
  // does nothing — dwell remounts once !melt holds again and folds the finished
  // sentence naturally.
  useEffect(() => {
    const rising = melt && !prevMeltRef.current;
    prevMeltRef.current = melt;
    if (rising) say("melt");
  }, [melt, say]);

  // Eye tracking: resident means always on (mutates the <g> transform directly, zero
  // re-renders — the same trick as Melt.tsx). The viewBox renders 1:1, so eye centers
  // = root rect top-left + known user-unit offsets — no conversion needed.
  useEffect(() => {
    if (noMotion) return;
    let raf = 0;
    let mx = 0;
    let my = 0;
    const tick = () => {
      raf = 0;
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      // Pupil home positions (24,22) / (43,22); the default gaze tilts slightly
      // upward — eager to please.
      const eyes: [SVGGElement | null, number][] = [
        [pupilL.current, 24],
        [pupilR.current, 43],
      ];
      for (const [el, ox] of eyes) {
        if (!el) continue;
        const dx = mx - (r.left + ox);
        const dy = my - (r.top + 22);
        const m = Math.min(1, 3 / (Math.hypot(dx, dy) || 1)); // clamped to a 3px radius (socket rx9 − pupil r4)
        el.style.transform = `translate(${(dx * m).toFixed(2)}px, ${(dy * m).toFixed(2)}px)`;
      }
    };
    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick); // rAF coalesces frames
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    // refs may point elsewhere by cleanup time — capture the elements on the way in.
    const pupils = [pupilL.current, pupilR.current];
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
      for (const el of pupils) {
        if (el) el.style.transform = ""; // reset — don't freeze mid-squint.
      }
    };
  }, [noMotion]);

  // Drag: the same pointer-capture approach as DesktopIcon, with one difference — the
  // pet advances lines on single click (no double-click), so the 400 ms guard means
  // "don't switch lines right after a drag" rather than "don't open".
  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    // No stopPropagation: clicking the pet must still let the desktop container close
    // the start menu.
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      dx: e.clientX - pos.x,
      dy: e.clientY - pos.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    // Movement under 4px reads as tremor, not a drag — leave it to the click.
    if (!d.moved) {
      if (Math.abs(e.clientX - d.px) < 4 && Math.abs(e.clientY - d.py) < 4) return;
      d.moved = true;
    }
    setPos(placeAt(window.innerWidth, window.innerHeight, e.clientX - d.dx, e.clientY - d.dy));
  };
  const onUp = () => {
    if (drag.current?.moved) movedAt.current = Date.now();
    drag.current = null;
  };

  if (!pos) return null;

  // Bubble flip: the vertical side depends on headroom; the tail side was decided at
  // placement.
  const above = pos.y > 150;

  return (
    <div
      ref={rootRef}
      className="clip-root absolute z-[865] w-[60px] select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="clip-enter">
        <div className="clip-bob">
          <button
            type="button"
            aria-label={t("clip.title")}
            className="block focus:outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-white"
            style={{ touchAction: "none" }}
            onPointerDown={onDown}
            onPointerMove={onDrag}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - movedAt.current < 400) return; // the click right after a drag doesn't count
              setLine(pick(pool));
              setTyped(0);
            }}
          >
            <svg className="clip-svg" viewBox="0 0 60 84" width={W} height={H} aria-hidden>
              <defs>
                <linearGradient id="clip-sheen" gradientUnits="userSpaceOnUse" x1="14" y1="3" x2="46" y2="76">
                  <stop offset="0" stopColor="#e9edf0" />
                  <stop offset=".45" stopColor="#a9b3bb" />
                  <stop offset="1" stopColor="#7e8890" />
                </linearGradient>
              </defs>
              {/* One continuous centerline strokes the whole clip; the eyes hang on the
                  two shoulders of the top arch. */}
              <path
                d={BODY_PATH}
                stroke="url(#clip-sheen)"
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Eye: large ellipse + pupil offset down-right, plus a highlight speck.
                  The blink animation uses fill-box and derives its own origin. */}
              <g className="clip-eye">
                <ellipse cx="22" cy="20" rx="9" ry="10" fill="#fff" stroke="#3a4550" strokeWidth="2" />
                <g ref={pupilL}>
                  <circle cx="24" cy="22" r="4" fill="#12181e" />
                  <circle cx="22.8" cy="20.8" r="1.3" fill="#fff" />
                </g>
              </g>
              <g className="clip-eye">
                <ellipse cx="41" cy="20" rx="9" ry="10" fill="#fff" stroke="#3a4550" strokeWidth="2" />
                <g ref={pupilR}>
                  <circle cx="43" cy="22" r="4" fill="#12181e" />
                  <circle cx="41.8" cy="20.8" r="1.3" fill="#fff" />
                </g>
              </g>
              {/* Raised brows. */}
              <path d="M14 8 q8 -5 16 -1" stroke="#3a4550" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M35 7 q8 -4 15 2" stroke="#3a4550" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* The bubble hangs on the entrance layer, not the bob layer: it follows the
            bounce but not the sway, so the text doesn't wobble. */}
        {line && (
          <div
            className={`clip-bubble clip-${above ? "above" : "below"} clip-${pos.tailRight ? "tail-right" : "tail-left"}`}
            role="status"
          >
            <span className="sr-only">{line}</span>
            <span aria-hidden>
              {noMotion ? line : line.slice(0, typed)}
              {!noMotion && typed < line.length && <span className="clip-caret cursor-blink" />}
            </span>
            <button
              type="button"
              className="clip-x"
              aria-label={t("clip.mute")}
              onClick={() => {
                penaltyRef.current = 1.6; // one-shot penalty, consumed at the next scheduling pass
                setLine(""); // folds the bubble only — the body stays on stage
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
