"use client";

// TV repair mini-game (REPAIR.EXE): the repair has to be earned. The window hosts a
// dying CRT whose screen runs the very GlitchRenderer behind the ambient page glitch —
// the fault vocabulary retired from ambient episodes (snow / vertical roll / jitter /
// color ghosts) is brought back on purpose here: a TV waiting to be repaired is
// supposed to look like this, and only inside this window.
//
// Pure-casual whack-a-spark: a short-circuit spark perches somewhere on the cabinet;
// each hit repairs exactly one named fault (STAGES below) with an onomatopoeia chip,
// and the fifth hit eases the picture to a clean test card — only then does the
// winner get the interference mute. No timer, no fail; closing early just wastes the
// repairman's trip (snarky farewell from the unmount cleanup).

import { useEffect, useRef, useState } from "react";
import { useDesktop } from "./context";
import { GlitchRenderer } from "./GlitchRenderer";
import { GlyphInfo } from "./icons";
import { StatusBar } from "./windows";
import { useI18n } from "../../lib/i18n/LanguageContext";
import type { DictKey } from "../../lib/i18n/dict";

// Screen buffer: 4:3 at 2× the on-screen size, so the color bars stay crisp.
const SCREEN_W = 576;
const SCREEN_H = 432;

type Stage = {
  snow: number; // grain amount 0..1
  roll: number; // vertical-roll speed, fraction of the frame height per second
  vjit: number; // vertical jitter amplitude (px)
  chroma: number; // R/B split baseline (px)
  split: number; // full-screen split amplitude (px)
  ghost: number; // red/cyan ghost blend 0..1
  fixedKey: DictKey | null; // fault repaired by ARRIVING at this stage
};

// One whack = one fault gone. Hand-tuned so every stage reads differently on screen:
// bounce dies first, then the color fringes, then the crawl slows, stops, and finally
// the grain washes out.
const STAGES: Stage[] = [
  { snow: 0.85, roll: 0.2, vjit: 5, chroma: 4.5, split: 2.5, ghost: 0.32, fixedKey: null },
  { snow: 0.85, roll: 0.2, vjit: 0, chroma: 4.5, split: 2.5, ghost: 0.32, fixedKey: "repair.fault.jitter" },
  { snow: 0.7, roll: 0.16, vjit: 0, chroma: 1.4, split: 1, ghost: 0, fixedKey: "repair.fault.ghost" },
  { snow: 0.6, roll: 0.055, vjit: 0, chroma: 0.9, split: 0.6, ghost: 0, fixedKey: "repair.fault.drift" },
  { snow: 0.45, roll: 0, vjit: 0, chroma: 0.5, split: 0.35, ghost: 0, fixedKey: "repair.fault.sync" },
  { snow: 0, roll: 0, vjit: 0, chroma: 0, split: 0, ghost: 0, fixedKey: "repair.fault.snow" },
];
const HITS_TO_FIX = STAGES.length - 1;

// One whack = one manga-style onomatopoeia chip.
const HIT_KEYS: DictKey[] = ["repair.hit.1", "repair.hit.2", "repair.hit.3", "repair.hit.4", "repair.hit.5"];

// Spark perches in % of the TV block: antenna tips, cabinet corners, the glass itself.
const SPOTS = [
  { x: 13, y: 13 },
  { x: 87, y: 11 },
  { x: 50, y: 7 },
  { x: 7, y: 46 },
  { x: 93, y: 50 },
  { x: 11, y: 89 },
  { x: 89, y: 91 },
  { x: 43, y: 58 },
];

const pickNext = (cur: number) => {
  const n = Math.floor(Math.random() * SPOTS.length);
  return n === cur ? (n + 1) % SPOTS.length : n;
};

// SMPTE-ish test card: 75% bars, castellation strip, station id band and a center
// circle — the picture the snow has been hiding.
function drawTestCard(c: CanvasRenderingContext2D) {
  const { width: w, height: h } = c.canvas;
  const bars = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];
  const bw = w / bars.length;
  const barH = h * 0.62;
  bars.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(i * bw, 0, Math.ceil(bw) + 1, barH);
  });
  const strip = ["#0000c0", "#131313", "#c000c0", "#131313", "#00c0c0", "#131313", "#c0c0c0"];
  strip.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(i * bw, barH, Math.ceil(bw) + 1, h * 0.08);
  });
  c.fillStyle = "#0a0a0a";
  c.fillRect(0, barH + h * 0.08, w, h);
  c.strokeStyle = "rgba(255,255,255,0.85)";
  c.lineWidth = 2;
  c.beginPath();
  c.arc(w / 2, h / 2, Math.min(w, h) * 0.36, 0, Math.PI * 2);
  c.stroke();
  c.textAlign = "center";
  c.fillStyle = "#fff";
  c.font = `bold ${Math.round(h * 0.105)}px "IBM Plex Mono", "PingFang SC", monospace`;
  c.fillText("Newboy OS", w / 2, h * 0.87);
  c.fillStyle = "#33ff66";
  c.font = `${Math.round(h * 0.055)}px "IBM Plex Mono", monospace`;
  c.fillText("NewBoy-TV · CH-03", w / 2, h * 0.945);
}

// Tiny UI thocks — lazy AudioContext, very short, very quiet: the page's own audio
// (the media player keeps singing) must stay the loudest thing on the desk.
let ac: AudioContext | null = null;
function sfxThock(i: number) {
  try {
    ac ??= new AudioContext();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(190 - i * 14, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.1);
  } catch {
    // no audio — the game plays fine silent
  }
}
function sfxLock() {
  try {
    ac ??= new AudioContext();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1318, t + 0.07);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.18);
  } catch {
    // Hype
  }
}

export default function RepairGame({ again, onWon }: { again: boolean; onWon: () => void }) {
  const api = useDesktop();
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  // Fresh dialog/close at call time: context re-creates them every Desktop render
  // (dialog tracks the z counter), and the unmount cleanup below must not fire a
  // stale-z dialog that would land under the topmost window.
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const [hits, setHits] = useState(0);
  const [spot, setSpot] = useState(() => Math.floor(Math.random() * SPOTS.length));
  const [phase, setPhase] = useState<"play" | "locking" | "locked">("play");
  const [pops, setPops] = useState<{ id: number; spot: number; text: string; rot: number }[]>([]);
  // Host for the imperatively-created screen canvas (see the effect below).
  const screenHostRef = useRef<HTMLDivElement | null>(null);
  const hitsRef = useRef(0);
  // Mirror for the rAF loop (at most one frame behind the committed phase).
  const phaseRef = useRef<"play" | "locking" | "locked">("play");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const popSeq = useRef(0);
  const wonRef = useRef(false);
  const mountedAt = useRef(0);

  const whack = () => {
    // hitsRef guard: the phaseRef mirror commits one render late, so a double-fire
    // on the final hit must be caught here, synchronously.
    if (phaseRef.current !== "play" || hitsRef.current >= HITS_TO_FIX) return;
    const i = hitsRef.current;
    sfxThock(i);
    popSeq.current += 1;
    const pop = { id: popSeq.current, spot, text: t(HIT_KEYS[i]), rot: Math.round(Math.random() * 14 - 7) };
    setPops((ps) => [...ps, pop]);
    setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== pop.id)), 750);
    hitsRef.current = i + 1;
    setHits(i + 1);
    if (i + 1 >= HITS_TO_FIX) {
      // The render loop eases the picture to clean, then flips phase to "locked".
      setPhase("locking");
    } else {
      setSpot(pickNext(spot));
    }
  };

  // Screen: one GlitchRenderer over a test card, fault params from the stage table.
  // The canvas is created imperatively per mount: the renderer's dispose() kills the
  // canvas' WebGL context for good, and a canvas living in JSX would survive the
  // StrictMode double-mount only to hand the remount a dead context (getContext
  // returns the same lost object forever).
  useEffect(() => {
    mountedAt.current = Date.now();
    const host = screenHostRef.current;
    if (!host) return;
    const cv = document.createElement("canvas");
    cv.width = SCREEN_W;
    cv.height = SCREEN_H;
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    host.appendChild(cv);
    let renderer: GlitchRenderer;
    try {
      renderer = new GlitchRenderer(cv, 3.71);
      const card = document.createElement("canvas");
      card.width = SCREEN_W;
      card.height = SCREEN_H;
      const c2 = card.getContext("2d");
      if (c2) {
        drawTestCard(c2);
        renderer.setPicture(card);
      }
    } catch {
      return; // no WebGL / shader failed: the LED + pops still play over a dark screen
    }

    // Reduced motion: freeze the clock (grain and jitter hold still — a paused photo
    // of a broken set) and stop the roll crawl; whacking is user-initiated and stays.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let prev = performance.now();
    let roll = 0; // the shader takes an absolute offset, so the speed is integrated here
    let lockT = -1; // <0 until the final hit, then 0..1 tween progress
    let settled = false;
    const t0 = prev;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const t = reduced ? 0 : (now - t0) / 1000;
      const ph = phaseRef.current;
      let st = ph === "play" ? STAGES[hitsRef.current] : STAGES[STAGES.length - 1];
      if (ph === "locking") {
        lockT = lockT < 0 ? 0 : Math.min(1, lockT + dt / 1.05);
        const k = lockT * lockT * (3 - 2 * lockT);
        st = { ...STAGES[HITS_TO_FIX - 1] };
        for (const key of ["snow", "chroma", "split"] as const) st[key] *= 1 - k;
        if (lockT >= 1 && !settled) {
          settled = true;
          setPhase("locked");
        }
      }
      if (st.roll > 0) roll = (roll + st.roll * (reduced ? 0 : dt)) % 1;
      // Roll speed hit zero: ease the residual offset to the nearest whole frame so
      // the card settles aligned instead of freezing mid-wrap.
      else if (roll > 1e-3) roll += (Math.round(roll) - roll) * Math.min(1, dt * 5);
      else roll = 0;
      const breathe = reduced ? 1 : 1 + 0.06 * Math.sin(t * 2.6);
      renderer.draw({
        time: t,
        env: 1,
        tear: 0,
        chroma: st.chroma * breathe,
        split: st.split * breathe,
        ghost: st.ghost,
        snow: Math.min(1, st.snow * breathe),
        vjit: reduced ? 0 : st.vjit,
        roll,
      });
    };
    // Draw frame 0 synchronously — waiting for the first rAF would flash one blank
    // frame (same reasoning as SignalGlitch).
    tick(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      cv.remove();
      // Abandonment: only when the window really lived and the set was never finished
      // — the StrictMode double-mount dies young and must not bill the user.
      if (!wonRef.current && Date.now() - mountedAt.current > 1500) {
        apiRef.current.dialog(tRef.current("repair.abandonTitle"), [
          tRef.current("repair.abandonFee"),
          tRef.current("repair.abandonLook"),
          tRef.current("repair.abandonBroken"),
        ]);
      }
    };
  }, []);

  // Locked: hand the prize out. onWon (Desktop) mutes the ambient interference and
  // owns the timer; the script stays here with the game.
  useEffect(() => {
    if (phase !== "locked") return;
    wonRef.current = true;
    onWon();
    sfxLock();
    apiRef.current.dialog(
      tRef.current("repair.winTitle"),
      again
        ? [tRef.current("repair.renewed"), tRef.current("repair.clearAgain"), tRef.current("repair.neighbor")]
        : [tRef.current("repair.firstWin"), tRef.current("repair.clearFirst"), tRef.current("repair.warranty")],
      "info",
    );
    // Let the clean test card sit on the desk for a beat before the window leaves.
    const bye = setTimeout(() => apiRef.current.close("repair"), 1800);
    return () => clearTimeout(bye);
  }, [phase, onWon, again]);

  const statusLeft =
    phase === "locking"
      ? t("repair.locking")
      : phase === "locked"
        ? t("repair.locked")
        : hits === 0
          ? t("repair.faults")
          : t("repair.fixed")
              .replace("{hits}", String(hits))
              .replace("{total}", String(HITS_TO_FIX))
              .replace("{fault}", t(STAGES[hits].fixedKey!));

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-[6px] p-2">
      {/* House rules, installer-hint style: the spark is deliberately subtle on a
          snow-filled screen, so say how the game is played instead of hoping. */}
      <div className="flex shrink-0 items-center gap-2 px-1 text-[12px]">
        <GlyphInfo size={20} />
        <span className="leading-[20px]">
          {t("repair.instructions")}
        </span>
      </div>
      {/* The patient: rabbit-ear antenna, silver cabinet, tuning knob (it turns with
          every hit — the whack jostles the front panel), speaker grille. */}
      <div className="relative mx-auto w-full max-w-[372px] pt-[26px] pb-[12px]">
        <div className="absolute inset-x-0 top-0 h-[30px]" aria-hidden>
          <span className="absolute left-1/2 bottom-0 h-[3px] w-[34px] -translate-x-1/2 bg-[#0a0a0a]" />
          <span className="absolute left-1/2 bottom-[2px] h-[30px] w-[2px] origin-bottom -translate-x-1/2 rotate-[-26deg] bg-[#0a0a0a]" />
          <span className="absolute left-1/2 bottom-[2px] h-[30px] w-[2px] origin-bottom -translate-x-1/2 rotate-[26deg] bg-[#0a0a0a]" />
        </div>
        <div className="flex gap-[10px] bevel-out bg-[#c3c3c3] p-[10px]">
          <div className="flex-1 min-w-0 bevel-in bg-[#0a0a0a] p-[6px]">
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <div ref={screenHostRef} className="absolute inset-0" />
              {phase !== "play" && <div className="repair-flash" aria-hidden />}
            </div>
          </div>
          <div className="flex w-[34px] shrink-0 flex-col items-center gap-[10px] py-[4px]">
            <div
              className="h-6 w-6 rounded-full bevel-thin-out bg-[#c0c0c0] transition-transform duration-300"
              style={{ transform: `rotate(${hits * 67}deg)` }}
              aria-hidden
            >
              <span className="mx-auto mt-[2px] block h-[8px] w-[2px] bg-[#0a0a0a]" />
            </div>
            <div className="h-6 w-6 rounded-full bevel-thin-out bg-[#c0c0c0]" aria-hidden>
              <span className="mx-auto mt-[2px] block h-[8px] w-[2px] bg-[#404040]" />
            </div>
            <div
              className="mt-1 h-full w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, #8f8f8f 0 2px, transparent 2px 6px)",
              }}
              aria-hidden
            />
          </div>
        </div>
        <span className="absolute bottom-0 left-[16%] h-[12px] w-[28px] bg-[#404040]" aria-hidden />
        <span className="absolute bottom-0 right-[16%] h-[12px] w-[28px] bg-[#404040]" aria-hidden />

        {phase === "play" && (
          <button
            type="button"
            aria-label={t("repair.sparkAria")}
            className="repair-spark"
            style={{ left: `${SPOTS[spot].x}%`, top: `${SPOTS[spot].y}%` }}
            onClick={whack}
          />
        )}
        {pops.map((p) => (
          <div
            key={p.id}
            className="repair-pop"
            style={{ left: `${SPOTS[p.spot].x}%`, top: `${SPOTS[p.spot].y}%`, rotate: `${p.rot}deg` }}
          >
            <span>{p.text}</span>
          </div>
        ))}
      </div>

      {/* Signal meter: the phosphor LED bar doubles as the progress readout. */}
      <div className="flex shrink-0 items-center gap-2 px-1 text-[12px]">
        <span className="shrink-0">{t("repair.signal")}</span>
        <div className="flex gap-[2px] bevel-thin-in bg-[#0a0a0a] p-[2px]">
          {Array.from({ length: HITS_TO_FIX }, (_, i) => (
            <span
              key={i}
              className={`h-[10px] w-[14px] ${i < hits ? "bg-[#33ff66] shadow-[0_0_4px_#33ff66]" : "bg-[#14351c]"}`}
            />
          ))}
        </div>
        <span className="ml-auto shrink-0">
          {t("repair.progress")
            .replace("{hits}", String(Math.min(hits, HITS_TO_FIX)))
            .replace("{total}", String(HITS_TO_FIX))}
        </span>
      </div>
      <StatusBar left={statusLeft} right="CH-03" />
    </div>
  );
}
