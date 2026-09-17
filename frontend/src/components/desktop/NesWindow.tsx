"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, NES, type ButtonKey } from "jsnes";
import { useDesktop } from "./context";
import { MenuBar, StatusBar } from "./windows";
import { CartridgeIcon, PixelIcon } from "./icons";
import { useI18n } from "../../lib/i18n/LanguageContext";

const SCREEN_W = 256;
const SCREEN_H = 240;
const NES_FPS = 60.0988; // NTSC field rate — fallback clock when audio is unavailable
const MAX_ROM_BYTES = 2 * 1024 * 1024;
const MAX_FRAMES_PER_RAF = 6; // catch-up cap after a hidden tab / slow rAF
const DEFAULT_VOLUME = 0.35; // the desk's own music stays the loudest thing
const TARGET_LATENCY_S = 0.06; // ring watermark the frame loop refills to

// The worklet owns the only consuming ring. Kept inline as a string (loaded via a
// blob URL) so the emulator stays a single file; reports its fill level every
// quantum, and the main thread paces emulation off that feedback — immune to
// 120 Hz rAF and audio/main-thread clock drift alike.
const WORKLET_SRC = `
class NesAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(16384);
    this.r = 0; this.w = 0; this.count = 0;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === "samples") {
        const s = d.samples;
        for (let i = 0; i < s.length; i++) {
          if (this.count < 16384) { this.ring[this.w] = s[i]; this.w = (this.w + 1) & 16383; this.count++; }
        }
      } else if (d.type === "flush") {
        this.r = this.w = this.count = 0;
      }
    };
  }
  process(_, outputs) {
    const L = outputs[0][0], R = outputs[0][1] || L, n = L.length;
    for (let i = 0; i < n && this.count > 0; i++) {
      L[i] = R[i] = this.ring[this.r];
      this.r = (this.r + 1) & 16383; this.count--;
    }
    this.port.postMessage({ type: "level", level: this.count });
    return true; // starved quanta output silence and the graph stays alive
  }
}
registerProcessor("nes-audio", NesAudioProcessor);
`;

// Keyboard → NES pad. X/K share A and Z/J share B (two hand positions);
// keyup only releases a button once every code mapped to it is up.
const KEY_MAP: Record<string, ButtonKey> = {
  ArrowUp: Controller.BUTTON_UP,
  ArrowDown: Controller.BUTTON_DOWN,
  ArrowLeft: Controller.BUTTON_LEFT,
  ArrowRight: Controller.BUTTON_RIGHT,
  KeyX: Controller.BUTTON_A,
  KeyK: Controller.BUTTON_A,
  KeyZ: Controller.BUTTON_B,
  KeyJ: Controller.BUTTON_B,
  Enter: Controller.BUTTON_START,
  ShiftLeft: Controller.BUTTON_SELECT,
  ShiftRight: Controller.BUTTON_SELECT,
};
const CODES_BY_BUTTON = new Map<ButtonKey, string[]>();
for (const [code, btn] of Object.entries(KEY_MAP)) {
  const list = CODES_BY_BUTTON.get(btn) ?? [];
  list.push(code);
  CODES_BY_BUTTON.set(btn, list);
}

// The console: a closed window unmounts its component, so the deck lives at module
// scope and survives like a real Famicom left powered on. Mounts attach a sink
// (current canvas + audio scratch); unmounts null it. (Minimize no longer unmounts
// the window — it just goes display:none and the game keeps running.)
type NesSink = { onFrame: (frame: Uint32Array) => void; onAudio: (left: number) => void };
const deck = {
  nes: null as NES | null,
  romData: null as Uint8Array | null,
  romName: null as string | null,
  sink: null as NesSink | null,
  lastFrame: new Uint32Array(SCREEN_W * SCREEN_H),
  frameDrawn: false,
  ac: null as AudioContext | null,
  gain: null as GainNode | null,
  node: null as AudioWorkletNode | null,
  workletUrl: null as string | null,
  level: 0,
  scratch: new Float32Array(4096),
  scratchLen: 0,
  hasRom: false,
  running: false,
  paused: false,
  crashed: false,
};

function flushRing() {
  deck.node?.port.postMessage({ type: "flush" });
  deck.level = 0;
}

// Dev-only handle for browser-driven verification of the audio pacing state.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as { __nesDeck?: typeof deck }).__nesDeck = deck;
}

// Created lazily inside the ROM-load gesture. The callbacks are eternal
// forwarders: they always look up the current sink, so reset()/reloadROM() keep
// the wiring and an unmounted window is just a null away from disconnected.
function ensureNes() {
  deck.nes ??= new NES({
    sampleRate: deck.ac?.sampleRate ?? 48000,
    onFrame: (f) => deck.sink?.onFrame(f),
    onAudioSample: (l) => deck.sink?.onAudio(l),
  });
}

async function ensureAudio() {
  if (deck.ac) {
    void deck.ac.resume().catch(() => {});
    return;
  }
  try {
    const ac = new AudioContext();
    deck.workletUrl ??= URL.createObjectURL(new Blob([WORKLET_SRC], { type: "text/javascript" }));
    await ac.audioWorklet.addModule(deck.workletUrl);
    const gain = ac.createGain();
    gain.gain.value = DEFAULT_VOLUME;
    const node = new AudioWorkletNode(ac, "nes-audio", { outputChannelCount: [2] });
    node.port.onmessage = (e) => {
      if (e.data?.type === "level") deck.level = e.data.level;
    };
    node.connect(gain).connect(ac.destination);
    deck.ac = ac;
    deck.gain = gain;
    deck.node = node;
    if (ac.state === "suspended") {
      // The awaited arrayBuffer() can outlive the transient activation.
      const kick = () => void ac.resume().catch(() => {});
      window.addEventListener("pointerdown", kick, { once: true });
      window.addEventListener("keydown", kick, { once: true });
    }
  } catch {
    // No worklet / no audio: the game runs silent on the timer clock.
    deck.node = null;
  }
}

export default function NesWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  // Fresh dialog at call time (context re-creates api every Desktop render).
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  // UI mirrors of the deck — re-initialized from it on every remount.
  const [romName, setRomName] = useState<string | null>(deck.romName);
  const [paused, setPaused] = useState(deck.paused);
  const [crashed, setCrashed] = useState(deck.crashed);
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(DEFAULT_VOLUME);
  const [dragOver, setDragOver] = useState(false);
  const [focused, setFocused] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameAreaRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const volBarRef = useRef<HTMLDivElement | null>(null);
  const heldCodesRef = useRef<Set<string>>(new Set());
  const downButtonsRef = useRef<Set<ButtonKey>>(new Set());

  const releaseHeld = useCallback(() => {
    for (const b of downButtonsRef.current) deck.nes?.buttonUp(1, b);
    downButtonsRef.current.clear();
    heldCodesRef.current.clear();
  }, []);

  const crash = useCallback((err: unknown) => {
    // jsnes latches a crash: every further frame() throws, so stop once.
    deck.running = false;
    deck.crashed = true;
    setCrashed(true);
    apiRef.current.dialog(t("nes.crashTitle"), [
      t("nes.crashCore"),
      String(err instanceof Error ? err.message : err),
      t("nes.crashRetry"),
    ]);
  }, [t]);

  // Screen + emulation loop. The canvas is created imperatively per mount (JSX
  // would survive the StrictMode double-mount only to hand the remount a stale
  // companion); the NES and the audio graph are never torn down here — the next
  // mount (restore from minimize, reopen) reattaches to them.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const cv = document.createElement("canvas");
    cv.width = SCREEN_W;
    cv.height = SCREEN_H;
    cv.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;image-rendering:pixelated";
    host.appendChild(cv);
    const ctx = cv.getContext("2d");
    const img = ctx?.createImageData(SCREEN_W, SCREEN_H) ?? null;
    const buf32 = img ? new Uint32Array(img.data.buffer) : null;
    let dirty = false;

    deck.sink = {
      onFrame: (f) => {
        // jsnes pixels are 0x00BBGGRR; the canvas stores premultiplied alpha, so
        // the high byte must be forced to opaque or everything draws transparent.
        for (let i = 0; i < f.length; i++) deck.lastFrame[i] = f[i];
        deck.frameDrawn = true;
        if (buf32) {
          for (let i = 0; i < f.length; i++) buf32[i] = f[i] | 0xff000000;
          dirty = true;
        }
      },
      onAudio: (l) => {
        if (deck.scratchLen < deck.scratch.length) deck.scratch[deck.scratchLen++] = l;
      },
    };
    // Restore the parked frame so a restore-from-minimize never flashes black.
    if (deck.frameDrawn && buf32 && img && ctx) {
      for (let i = 0; i < deck.lastFrame.length; i++) buf32[i] = deck.lastFrame[i] | 0xff000000;
      ctx.putImageData(img, 0, 0);
    }

    const flushScratch = () => {
      if (deck.scratchLen === 0) return;
      if (deck.node) {
        const chunk = deck.scratch.slice(0, deck.scratchLen);
        deck.node.port.postMessage({ type: "samples", samples: chunk }, [chunk.buffer]);
      }
      deck.scratchLen = 0; // no consumer → drop, don't bank stale audio
    };

    let raf = 0;
    let prev = performance.now();
    let acc = 0;
    const FRAME_S = 1 / NES_FPS;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!deck.hasRom || !deck.running || deck.paused || deck.crashed || document.hidden) {
        prev = now;
        return;
      }
      const nes = deck.nes;
      if (!nes) {
        prev = now;
        return;
      }
      try {
        if (deck.ac?.state === "running" && deck.node) {
          // Audio-clock pacing: refill the ring to the target watermark. Decoupled
          // from the rAF rate, so 120 Hz screens don't double the game speed.
          const target = deck.ac.sampleRate * TARGET_LATENCY_S;
          let n = 0;
          while (deck.level < target && n++ < MAX_FRAMES_PER_RAF) {
            nes.frame();
            flushScratch();
          }
        } else {
          acc += Math.min((now - prev) / 1000, 0.05);
          let n = 0;
          while (acc >= FRAME_S && n++ < MAX_FRAMES_PER_RAF) {
            nes.frame();
            acc -= FRAME_S;
          }
        }
      } catch (err) {
        crash(err);
        return;
      }
      if (dirty && ctx && img) {
        ctx.putImageData(img, 0, 0);
        dirty = false;
      }
      prev = now;
    };
    tick(performance.now()); // draw frame 0 synchronously — no blank flash

    if (!deck.paused && deck.ac) {
      void deck.ac
        .resume()
        .then(() => flushRing()) // the ring holds pre-suspend samples
        .catch(() => {});
    }

    return () => {
      cancelAnimationFrame(raf);
      deck.sink = null;
      releaseHeld(); // a key held across a minimize must not stay down
      void deck.ac?.suspend().catch(() => {});
      cv.remove();
    };
  }, [releaseHeld, crash]);

  useEffect(() => {
    if (deck.gain && deck.ac) {
      deck.gain.gain.setTargetAtTime(muted ? 0 : vol, deck.ac.currentTime, 0.01);
    }
  }, [muted, vol]);

  const loadRom = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      const bad = (lines: string[]) => apiRef.current.dialog(t("nes.crashTitle"), lines);
      if (!/\.nes$/i.test(file.name)) {
        bad([t("nes.badFormat"), t("nes.onlyNes")]);
        return;
      }
      if (file.size > MAX_ROM_BYTES) {
        bad([t("nes.tooLarge"), t("nes.sizeLimit")]);
        return;
      }
      let u8: Uint8Array;
      try {
        u8 = new Uint8Array(await file.arrayBuffer());
      } catch {
        bad([t("nes.unreadable"), t("nes.fileUnreadable")]);
        return;
      }
      // Pre-check the iNES magic ourselves: a failed loadROM already swaps the
      // emulator's internal ROM object and would dirty the running game.
      if (u8[0] !== 0x4e || u8[1] !== 0x45 || u8[2] !== 0x53 || u8[3] !== 0x1a) {
        bad([t("nes.notCartridge"), t("nes.missingHeader")]);
        return;
      }
      await ensureAudio();
      ensureNes();
      releaseHeld(); // the old game's controller state dies with the old cart
      try {
        deck.nes!.loadROM(u8);
      } catch (err) {
        if (deck.romData) deck.nes!.loadROM(deck.romData); // put the old cart back
        bad([t("nes.cartUnreadable"), String(err instanceof Error ? err.message : err)]);
        return;
      }
      deck.romData = u8;
      deck.romName = file.name;
      deck.hasRom = true;
      deck.running = true;
      deck.paused = false;
      deck.crashed = false;
      deck.frameDrawn = false;
      flushRing();
      setRomName(file.name);
      setPaused(false);
      setCrashed(false);
      gameAreaRef.current?.focus();
    },
    [releaseHeld, t],
  );

  const restart = useCallback(() => {
    if (!deck.nes || !deck.romData) return;
    releaseHeld();
    try {
      deck.nes.reloadROM();
    } catch {
      return;
    }
    deck.running = true;
    deck.paused = false;
    deck.crashed = false;
    deck.frameDrawn = false;
    flushRing();
    setPaused(false);
    setCrashed(false);
    gameAreaRef.current?.focus();
  }, [releaseHeld]);

  // Pause parks the audio clock too; resume flushes so no stale ring plays.
  const togglePause = useCallback(() => {
    if (!deck.hasRom) return;
    deck.paused = !deck.paused;
    setPaused(deck.paused);
    if (deck.paused) {
      void deck.ac?.suspend().catch(() => {});
    } else {
      flushRing();
      void deck.ac?.resume().catch(() => {});
    }
    gameAreaRef.current?.focus();
  }, []);

  const setVolFromX = useCallback((clientX: number) => {
    const el = volBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setVol(v);
    if (v > 0) setMuted(false);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const btn = KEY_MAP[e.code];
    if (btn === undefined || e.repeat) return;
    e.preventDefault(); // arrows must not scroll the desk
    heldCodesRef.current.add(e.code);
    if (downButtonsRef.current.has(btn)) return;
    downButtonsRef.current.add(btn);
    deck.nes?.buttonDown(1, btn);
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    const btn = KEY_MAP[e.code];
    if (btn === undefined) return;
    heldCodesRef.current.delete(e.code);
    const twinStillDown = (CODES_BY_BUTTON.get(btn) ?? []).some(
      (code) => code !== e.code && heldCodesRef.current.has(code),
    );
    if (!twinStillDown && downButtonsRef.current.delete(btn)) {
      deck.nes?.buttonUp(1, btn);
    }
  };

  const btnCls =
    "bevel-thin-out bg-chrome px-3 py-[3px] text-[12px] press disabled:opacity-50 disabled:pointer-events-none";
  const statusRight = crashed ? "CRASHED" : romName === null ? "NO CART" : paused ? "PAUSED" : "RUNNING";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MenuBar
        items={[t("nes.menu.file"), t("nes.menu.game"), t("nes.menu.options"), t("nes.menu.help")]}
        right="FAMICOM v1.0"
      />
      {/* The screen owns keyboard focus: keys go to the pad only while it is
          focused, so the terminal and the writer keep theirs. */}
      <div
        ref={gameAreaRef}
        tabIndex={0}
        role="application"
        aria-label={t("nes.screenAria")}
        onMouseDown={(e) => e.currentTarget.focus()}
        onClick={() => {
          if (!deck.hasRom) fileInputRef.current?.click();
        }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={() => setFocused(true)}
        onBlur={releaseHeld}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void loadRom(e.dataTransfer.files[0]);
        }}
        className={`relative flex-1 min-h-0 bg-black bevel-in m-[3px] overflow-hidden outline-none ${
          dragOver ? "outline-2 outline-dotted outline-[#ddd8c8]" : ""
        }`}
      >
        <div ref={hostRef} className="absolute inset-0" />
        {romName === null ? (
          /* Empty slot: dashed well, click or drop a cart. */
          <div
            className={`absolute inset-[10px] border-2 border-dotted ${
              focused ? "border-[#808080]" : "border-[#404040]"
            } flex flex-col items-center justify-center gap-[10px] text-center select-none pointer-events-none`}
          >
            <PixelIcon sprite={CartridgeIcon} size={56} />
            <p className="font-display text-[22px] leading-none text-[#dfdfdf]">{t("nes.insertCart")}</p>
            <p className="text-[12px] text-[#808080]">{t("nes.insertHint")}</p>
            <p className="text-[11px] leading-[18px] text-[#606060]">{t("nes.controls")}</p>
          </div>
        ) : (
          dragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 select-none pointer-events-none">
              <p className="font-display text-[22px] text-[#dfdfdf]">{t("nes.dropToSwap")}</p>
            </div>
          )
        )}
      </div>
      {/* Controls: mute is gain-zero only — suspending would stop the pacing clock. */}
      <div className="flex shrink-0 items-center gap-1 px-2 py-[4px] flex-wrap">
        <button type="button" className={btnCls} onClick={() => fileInputRef.current?.click()}>
          {t("nes.load")}
        </button>
        <button type="button" className={btnCls} disabled={romName === null} onClick={restart}>
          {t("nes.restart")}
        </button>
        <button type="button" className={btnCls} disabled={romName === null} onClick={togglePause}>
          {paused ? t("nes.resume") : t("nes.pause")}
        </button>
        <button
          type="button"
          className={`${btnCls} w-[34px]!`}
          aria-label={muted || vol === 0 ? t("media.unmute") : t("media.mute")}
          onClick={() => setMuted((m) => !m)}
        >
          {muted || vol === 0 ? "🔇" : "🔊"}
        </button>
        <div
          ref={volBarRef}
          className="w-[64px] h-[8px] bevel-thin-in bg-[#101010] cursor-pointer touch-none"
          role="slider"
          aria-label={t("media.volume")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((muted ? 0 : vol) * 100)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setVolFromX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.buttons) setVolFromX(e.clientX);
          }}
        >
          <div className="h-full bg-[#1084d0]" style={{ width: `${(muted ? 0 : vol) * 100}%` }} />
        </div>
      </div>
      <StatusBar left={romName ?? "NO CARTRIDGE"} right={statusRight} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".nes"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ""; // cleared so the same cart can be re-inserted
          void loadRom(f);
        }}
      />
    </div>
  );
}
