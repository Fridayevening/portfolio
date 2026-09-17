"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as RKeyboardEvent,
  type MouseEvent as RMouseEvent,
  type ReactNode,
} from "react";
import { useDesktop } from "./context";
import { useOwnerState } from "../../lib/api/owner";
import { usePrivacyPrefs } from "./prefsState";
import { useI18n } from "../../lib/i18n/LanguageContext";
import { currentT, type DictKey, type Lang } from "../../lib/i18n/dict";
import {
  CartridgeIcon,
  ChartIcon,
  ComputerIcon,
  ConsoleIcon,
  FloppyIcon,
  GlyphError,
  GlyphInfo,
  JoystickIcon,
  MineIcon,
  PixelIcon,
  SearchIcon,
  TxtIcon,
} from "./icons";

// ── Common widgets ────────────────────────────────────

// Common widgets: exported for reuse by tool windows living in their own files
// (HotaruWindow etc.; MarketAlerts set the precedent).
export function MenuBar({ items, right, extra }: { items: string[]; right?: string; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1 py-[2px] text-[12px] shrink-0">
      {items.map((m) => (
        <span key={m} className="px-1 hover:bg-navy hover:text-white">
          {m}
        </span>
      ))}
      {extra}
      {right !== undefined && (
        <span className="ml-auto pr-1 text-[9px] text-black/50 select-none shrink-0 whitespace-nowrap">
          {right}
        </span>
      )}
    </div>
  );
}

export function StatusBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="h-[20px] shrink-0 flex items-stretch gap-[2px] text-[11px]">
      <span className="flex-1 bevel-thin-in px-[6px] flex items-center truncate">
        {left}
      </span>
      {right !== undefined && (
        <span className="w-[120px] bevel-thin-in px-[6px] flex items-center justify-end truncate">
          {right}
        </span>
      )}
    </div>
  );
}

export type FolderViewItem = {
  /** Stable key source (the label can become the rename input mid-edit). */
  id?: string;
  /** String, or the inline rename input while renaming. */
  label: ReactNode;
  icon: ReactNode;
  onOpen: () => void;
  onSelect?: () => void;
  selected?: boolean;
  /** Cut-clipboard visual. */
  dimmed?: boolean;
  onContextMenu?: (e: RMouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (e: RKeyboardEvent<HTMLDivElement>) => void;
};

export function FolderView({
  items,
  countLabel,
  bytesLabel,
  onBlankContextMenu,
}: {
  items: FolderViewItem[];
  countLabel?: string;
  bytesLabel?: string;
  /** Right-click on the empty area only (items' right-clicks don't bubble in). */
  onBlankContextMenu?: (e: RMouseEvent<HTMLDivElement>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-[2px]">
      <MenuBar items={[t("menu.file"), t("menu.edit"), t("menu.view"), t("menu.help")]} />
      <div
        className="flex-1 min-h-0 bg-white bevel-in p-2 flex flex-wrap content-start gap-1 overflow-auto"
        onContextMenu={(e) => {
          if (!onBlankContextMenu) return;
          // Only the bare surface — same guard the desktop root uses.
          if (e.target !== e.currentTarget) return;
          onBlankContextMenu(e);
        }}
      >
        {items.map((it) => (
          // div, not button: the label can host the inline rename input (interactive
          // content must not nest in a button); Enter/Space stay available via keydown.
          <div
            key={it.id ?? String(it.label)}
            role="button"
            tabIndex={0}
            className={`w-[84px] flex flex-col items-center gap-1 p-1 group cursor-default focus:outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black ${
              it.selected ? "bg-navy text-white" : "text-black"
            } ${it.dimmed ? "opacity-50" : ""}`}
            onPointerDown={() => it.onSelect?.()}
            onDoubleClick={it.onOpen}
            onContextMenu={it.onContextMenu}
            onKeyDown={it.onKeyDown}
          >
            {it.icon}
            <span className="w-full text-[11px] text-center leading-tight break-all group-hover:bg-navy group-hover:text-white group-hover:outline-1 group-hover:outline-dotted group-hover:outline-white">
              {it.label}
            </span>
          </div>
        ))}
      </div>
      <StatusBar left={countLabel ?? `${items.length} ${t("status.items")}`} right={bytesLabel ?? t("status.bytes0")} />
    </div>
  );
}

// ── Notepad family ────────────────────────────────────

export function ReadmeWindow() {
  const { t } = useI18n();
  const [long, setLong] = useState(false);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MenuBar items={[t("menu.file"), t("menu.edit"), t("menu.search"), t("menu.help")]} />
      <div className="flex-1 min-h-0 bg-white bevel-in overflow-auto p-3 text-[13px] leading-[1.7] whitespace-pre-wrap">
        {t("readme.short")}
        {long && `\n\n${t("readme.long")}`}
      </div>
      <div className="shrink-0 flex justify-center py-[3px]">
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press"
          onClick={() => setLong(!long)}
        >
          {long ? t("readme.collapse") : t("readme.expand")}
        </button>
      </div>
    </div>
  );
}

export function NotesWindow() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MenuBar items={[t("menu.file"), t("menu.edit"), t("menu.search"), t("menu.help")]} />
      <textarea
        defaultValue={t("notes.default")}
        spellCheck={false}
        className="flex-1 min-h-0 bg-white bevel-in p-2 text-[13px] leading-[1.6] outline-none resize-none"
      />
    </div>
  );
}

// ── Folder family ─────────────────────────────────────

export function MyComputerWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  return (
    <FolderView
      countLabel={t("status.objects4")}
      bytesLabel="640 KB"
      items={[
        {
          label: t("computer.floppy"),
          icon: <PixelIcon sprite={FloppyIcon} size={32} />,
          onOpen: () =>
            api.dialog(t("computer.driveTitle"), [
              t("computer.noDisk"),
              t("computer.neverDisk"),
            ]),
        },
        {
          label: "(C:)",
          icon: <PixelIcon sprite={ComputerIcon} size={32} />,
          onOpen: () => api.open("tools"),
        },
        {
          label: t("computer.controlPanel"),
          icon: <PixelIcon sprite={ConsoleIcon} size={32} />,
          onOpen: () =>
            api.dialog(
              t("computer.controlPanel"),
              [t("computer.noControl"), t("computer.inControl")],
              "info"
            ),
        },
        {
          label: t("computer.printer"),
          icon: <PixelIcon sprite={SearchIcon} size={32} />,
          onOpen: () =>
            api.dialog(t("computer.printer"), [t("computer.noPrinter"), t("computer.paperless")], "info"),
        },
      ]}
    />
  );
}

export function ToolsWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  return (
    <FolderView
      items={[
        // The README's promise cashed in: the first written tool moves into the
        // toolbox; the desktop icon stays as the shortcut.
        {
          label: "FAMICOM.EXE",
          icon: <PixelIcon sprite={CartridgeIcon} size={32} />,
          onOpen: () => api.open("nes"),
        },
        // Minesweeper lives toolbox-only by design (same treatment as imglab):
        // the Start menu / run / terminal keep their entries.
        {
          label: "WINMINE.EXE",
          icon: <PixelIcon sprite={MineIcon} size={32} />,
          onOpen: () => api.open("mines"),
        }
      ]}
      countLabel={t("status.objects6")}
      bytesLabel="2.1 MB"
    />
  );
}

export function LabWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  return (
    <FolderView
      items={[]}
      countLabel={t("status.objects0")}
      bytesLabel="∞ MB"
    />
  );
}

// BinWindow moved to its own file (Bin.tsx) — it renders real trash data now.

// ── Image viewer (a nod to the original site's Imaging Preview) ──────────
// Same structure as the original: darkroom background + cream-bordered photo + serif
// italic caption + status bar. Window sizes are fitted to each picture's aspect ratio
// in WIN_DEFS; the photo area's flex layout adapts as the fallback.

export function PhotoWindow({
  src,
  file,
  dims,
  caption,
}: {
  src: string;
  file: string;
  /** Caller-known dimensions; when omitted the img measures itself on load. */
  dims?: string;
  caption: string;
}) {
  const { t } = useI18n();
  const [measured, setMeasured] = useState<string | null>(null);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 bg-[#55524a] flex flex-col items-center gap-[8px] p-[12px] overflow-hidden">
        {/* The photo takes its own row; img is max-constrained both ways and the
            caption doesn't share its height. */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          {/* Static image skips next/image, keeping original pixel dimensions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={file}
            draggable={false}
            onLoad={(e) =>
              setMeasured(`${e.currentTarget.naturalWidth}x${e.currentTarget.naturalHeight}`)
            }
            className="block max-w-full max-h-full border-[3px] border-[#f4f0e4] select-none"
            style={{ boxShadow: "4px 5px 12px rgba(0,0,0,.5)" }}
          />
        </div>
        <p className="photo-cap text-center px-2 shrink-0">{caption}</p>
      </div>
      <StatusBar left={`${file} — ${dims ?? measured ?? "…"} — ${t("photo.truecolor")}`} right={t("photo.image")} />
    </div>
  );
}

// ── Compare windows (image/video): original vs the image tool's developing ────

// Darkroom frame: cream border + hard shadow, shared by the compare windows'
// img/video.
export const FRAME_CLS = "block max-w-full max-h-full border-[3px] border-[#f4f0e4] select-none";
export const FRAME_SHADOW = { boxShadow: "4px 5px 12px rgba(0,0,0,.5)" } as const;

// One cell of a compare window: a source tag on top, the picture filling the rest of
// the height. Both cells are equal width/height with same-size pictures on the same
// baseline — naturally aligned after scaling.
export function CompareCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="flex-1 min-w-0 min-h-0 flex flex-col items-center gap-[6px]">
      <span className="shrink-0 text-[10px] leading-[1.6] px-[6px] text-[#ddd8c8] bg-black/25 bevel-thin-in whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">{children}</div>
    </figure>
  );
}

// Two tellings of the same picture side by side: left the original, right the image
// tool's output.
export function PhotoCompareWindow({
  leftSrc,
  leftFile,
  leftLabel,
  rightSrc,
  rightFile,
  rightLabel,
  dims,
  caption,
}: {
  leftSrc: string;
  leftFile: string;
  leftLabel: string;
  rightSrc: string;
  rightFile: string;
  rightLabel: string;
  dims: string;
  caption: string;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 bg-[#55524a] flex flex-col gap-[8px] p-[12px] overflow-hidden">
        {/* Pictures take their own row, two cells at half width each; img is
            max-constrained both ways and the caption doesn't share the height. */}
        <div className="flex-1 min-h-0 w-full flex items-stretch justify-center gap-[10px]">
          <CompareCell label={leftLabel}>
            {/* Static image skips next/image, keeping original pixel dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={leftSrc} alt={leftFile} draggable={false} className={FRAME_CLS} style={FRAME_SHADOW} />
          </CompareCell>
          <CompareCell label={rightLabel}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={rightSrc} alt={rightFile} draggable={false} className={FRAME_CLS} style={FRAME_SHADOW} />
          </CompareCell>
        </div>
        <p className="photo-cap text-center px-2 shrink-0">{caption}</p>
      </div>
      <StatusBar left={`${leftFile} / ${rightFile} — ${dims} — ${t("photo.truecolor")}`} right={t("photo.image")} />
    </div>
  );
}

// Two textures of the same footage side by side: left the original, right a preset
// developing. Two videos starting on their own drift half a beat apart — both must
// buffer to canplay, then rewind to zero and start together; after that each loops on
// its own. Same-length clips aligned at the start stay in sync to the eye throughout.
export function VideoCompareWindow({
  leftSrc,
  leftFile,
  leftLabel,
  rightSrc,
  rightFile,
  rightLabel,
  dims,
  caption,
}: {
  leftSrc: string;
  leftFile: string;
  leftLabel: string;
  rightSrc: string;
  rightFile: string;
  rightLabel: string;
  dims: string;
  caption: string;
}) {
  const { t } = useI18n();
  const left = useRef<HTMLVideoElement>(null);
  const right = useRef<HTMLVideoElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const pair = [left.current, right.current];
    // The later canplay completes the pair; skip if already started or one isn't
    // buffered yet.
    const tryStart = () => {
      const vids = pair.filter((v): v is HTMLVideoElement => !!v);
      if (started.current || vids.length < 2 || vids.some((v) => v.readyState < 3)) return;
      started.current = true;
      for (const v of vids) {
        v.currentTime = 0;
        v.play().catch(() => {}); // muted playback isn't blocked; if it somehow is, the frozen-frame comparison still holds
      }
    };
    pair.forEach((v) => v?.addEventListener("canplay", tryStart));
    tryStart(); // for the case where buffering beat the listener
    return () => pair.forEach((v) => v?.removeEventListener("canplay", tryStart));
  }, []);
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 bg-[#55524a] flex flex-col gap-[8px] p-[12px] overflow-hidden">
        {/* Footage takes its own row, two cells at half width each; video is
            max-constrained both ways and the caption doesn't share the height. */}
        <div className="flex-1 min-h-0 w-full flex items-stretch justify-center gap-[10px]">
          <CompareCell label={leftLabel}>
            {/* Both videos muted — the comparison is visual; audio would only fight. */}
            <video ref={left} src={leftSrc} muted loop playsInline preload="auto" draggable={false} className={FRAME_CLS} style={FRAME_SHADOW} />
          </CompareCell>
          <CompareCell label={rightLabel}>
            <video ref={right} src={rightSrc} muted loop playsInline preload="auto" draggable={false} className={FRAME_CLS} style={FRAME_SHADOW} />
          </CompareCell>
        </div>
        <p className="photo-cap text-center px-2 shrink-0">{caption}</p>
      </div>
      <StatusBar left={`${leftFile} / ${rightFile} — ${dims} — ${t("photo.loop")}`} right={t("photo.image")} />
    </div>
  );
}

// ── Media player ──────────────────────────────────────

// This player refuses all control: it can't be closed, and it can't be stopped.
// Denial lines shared by close / play / pause / stop — a fresh random one each time.
export const MEDIA_DENY_TEXTS = [
  "I need more LEMONADE. ♪",
  "No way No way! ♪",
  "Don’t step on the brakes. ♪",
  "I take my karma straight. ♪",
  "Wait, hold up, no! ♪",
  "Nice try. ♪",
  "Don’t know what happened. ♪",
  "I ain’t got no ETA. ♪",
];

let lastDeny = -1;
export function pickDenyLine() {
  let i = Math.floor(Math.random() * MEDIA_DENY_TEXTS.length);
  if (i === lastDeny) i = (i + 1) % MEDIA_DENY_TEXTS.length; // no immediate repeats
  lastDeny = i;
  return MEDIA_DENY_TEXTS[i];
}

// ── Cola easter egg: rush-phase error-storm dialog copy ──────────
// Classic Windows error voice + sugar-overload gags; same no-immediate-repeat as
// pickDenyLine.
const COLA_ERROR_KEYS: { title: DictKey | "COLA.EXE"; lines: [DictKey, DictKey] }[] = [
  { title: "cola.systemError", lines: ["cola.1a", "cola.1b"] },
  { title: "COLA.EXE", lines: ["cola.2a", "cola.2b"] },
  { title: "cola.critical", lines: ["cola.3a", "cola.3b"] },
  { title: "cola.warning", lines: ["cola.4a", "cola.4b"] },
  { title: "cola.systemError", lines: ["cola.5a", "cola.5b"] },
  { title: "cola.critical", lines: ["cola.6a", "cola.6b"] },
  { title: "cola.warning", lines: ["cola.7a", "cola.7b"] },
  { title: "COLA.EXE", lines: ["cola.8a", "cola.8b"] },
  { title: "cola.systemError", lines: ["cola.9a", "cola.9b"] },
  { title: "cola.warning", lines: ["cola.10a", "cola.10b"] },
  { title: "cola.critical", lines: ["cola.11a", "cola.11b"] },
  { title: "COLA.EXE", lines: ["cola.12a", "cola.12b"] },
];

let lastErr = -1;
export function pickColaError() {
  let i = Math.floor(Math.random() * COLA_ERROR_KEYS.length);
  if (i === lastErr) i = (i + 1) % COLA_ERROR_KEYS.length; // no immediate repeats
  lastErr = i;
  const popup = COLA_ERROR_KEYS[i];
  return {
    title: popup.title === "COLA.EXE" ? popup.title : currentT(popup.title),
    lines: popup.lines.map(currentT),
  };
}


export function MediaPlayerWindow() {
  const { t } = useI18n();
  const api = useDesktop();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const volBarRef = useRef<HTMLDivElement>(null);

  // Sings the moment it mounts; if the browser's autoplay policy blocks it, wait for
  // the first interaction.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const kick = () => a.play().catch(() => {});
    a.play().catch(() => {
      window.addEventListener("pointerdown", kick, { once: true });
      window.addEventListener("keydown", kick, { once: true });
    });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, []);

  const deny = (e: React.MouseEvent<HTMLButtonElement>) =>
    api.tip(e.currentTarget, pickDenyLine());

  // Volume is this player's only real control: it can't be stopped, but it can be
  // turned down / muted.
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.volume = vol;
      a.muted = muted;
    }
  }, [vol, muted]);

  const setVolFromX = (clientX: number) => {
    const el = volBarRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const v = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setVol(v);
    if (v > 0) setMuted(false); // touching the volume bar conveniently unmutes
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Animated image skips next/image optimization, keeping the GIF playing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/11.gif"
        alt="LEMONADE"
        className="shrink-0 w-full h-[80px] object-cover select-none"
        draggable={false}
      />
      <div className="flex-1 min-h-0 bg-black bevel-in p-3 flex flex-col justify-between gap-[6px]">
        <div className="flex items-end justify-between gap-3">
          <div className="text-phosphor min-w-0">
            <p className="font-display text-[26px] leading-none text-glow truncate">
              I AIN'T GOT NO ETA.MP3
            </p>
            <p className="text-[11px] mt-1 opacity-80 truncate">
              I&rsquo;ll make it LEMONADE · {playing ? t("media.playing") : t("media.waiting")}
            </p>
          </div>
          {/* EQ boom-tss: two beats per cycle — tall bars hammer the heavy beat (boom),
              short bars skip the light beat (tss), each offset by tens of ms; a
              stagger, not a march. */}
          <div className="flex items-end gap-[3px] h-8 shrink-0" aria-hidden>
            {[
              { h: 18, hit: "eq-hit-lite", d: 0 },
              { h: 26, hit: "eq-hit-heavy", d: -0.1 },
              { h: 12, hit: "eq-hit-lite", d: -0.05 },
              { h: 30, hit: "eq-hit-heavy", d: -0.14 },
              { h: 22, hit: "eq-hit-heavy", d: -0.07 },
              { h: 15, hit: "eq-hit-lite", d: -0.12 },
            ].map((b, i) => (
              <span
                key={i}
                className={`w-[6px] bg-phosphor eq-bar ${b.hit} ${playing ? "" : "[animation-play-state:paused]"}`}
                style={{ height: `${b.h}px`, animationDelay: `${b.d}s` }}
              />
            ))}
          </div>
        </div>
        {/* No seek bar: this song has no progress, only forever. */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              className="winder w-[26px]! h-[22px]! text-phosphor"
              aria-label={t("media.play")}
              onClick={deny}
            >
              ▶
            </button>
            <button
              type="button"
              className="winder w-[26px]! h-[22px]!"
              aria-label={t("media.pause")}
              onClick={deny}
            >
              ❙❙
            </button>
            <button
              type="button"
              className="winder w-[26px]! h-[22px]!"
              aria-label={t("media.stop")}
              onClick={deny}
            >
              ■
            </button>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="winder w-[26px]! h-[22px]!"
                aria-label={muted || vol === 0 ? t("media.unmute") : t("media.mute")}
                onClick={() => setMuted((m) => !m)}
              >
                {muted || vol === 0 ? "🔇" : "🔊"}
              </button>
              <div
                ref={volBarRef}
                className="w-[64px] h-[8px] bevel-thin-in bg-[#0a1a0e] cursor-pointer touch-none"
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
                <div
                  className="h-full bg-phosphor/80"
                  style={{ width: `${(muted ? 0 : vol) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
        </div>
      </div>
      <StatusBar left="C:\MEDIA\LEMONWOLF.MP3" right="25¢" />
      <audio
        ref={audioRef}
        src="/media/lemon&wolf.mp3"
        preload="auto"
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}

// ── Terminal ──────────────────────────────────────────

const TERMINAL_IDS = [
  "mycomputer",
  "tools",
  "lab",
  "notes",
  "media",
  "readme",
  "terminal",
  "monitor",
  "hotaru",
  "aespu",
  "imgtool",
  "imglab",
  "paper",
  "nes",
  "mines",
  "stickies",
  "settings",
  "bin",
];

export function TerminalWindow() {
  const { t, lang } = useI18n();
  const api = useDesktop();
  // Curation (doc 08 §1.2): the visitor's ls/open never names hidden apps —
  // the command surface follows the menu surface.
  const ownerState = useOwnerState();
  const privacy = usePrivacyPrefs();
  const visitor = !ownerState.token || ownerState.preview;
  const ids = visitor ? TERMINAL_IDS.filter((id) => !privacy.hiddenApps.includes(id)) : TERMINAL_IDS;
  const [lines, setLines] = useState<string[]>([
    t("term.banner"),
    t("term.copyright"),
    "",
    t("term.promptHelp"),
    "",
  ]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const exec = (raw: string) => {
    const cmd = raw.trim();
    const out: string[] = [`C:\\NewBoy> ${cmd}`];
    const [head, ...rest] = cmd.toLowerCase().split(/\s+/);
    switch (head) {
      case "":
        break;
      case "help":
        out.push(
          t("term.help"),
          t("term.ls"),
          t("term.open"),
          t("term.glass"),
          t("term.ver"),
          t("term.date"),
          t("term.about"),
          t("term.clear"),
          t("term.shutdown"),
          t("term.exit"),
        );
        break;
      case "ls":
      case "dir":
        out.push(...ids.map((id) => `  ${id}`));
        break;
      case "open": {
        const target = rest[0]?.toLowerCase();
        if (!target) out.push(t("term.usageOpen"));
        else if (ids.includes(target)) {
          api.open(target);
          out.push(t("term.opening").replace("{t}", target));
        } else out.push(t("term.notFound").replace("{t}", target));
        break;
      }
      case "glass":
        api.toggleGlass();
        out.push(t("term.glassToggled"));
        break;
      case "ver":
        out.push(t("term.version"));
        break;
      case "date":
        out.push(new Date().toLocaleString(lang === "en" ? "en-US" : "zh-CN"));
        break;
      case "about":
        out.push(
          "NewBoy —— Let's back to the 1995 vibes."
        );
        break;
      case "clear":
      case "cls":
        setLines([]);
        setInput("");
        return;
      case "shutdown":
        out.push(t("term.shuttingDown"));
        setLines((l) => [...l, ...out, ""]);
        setInput("");
        setTimeout(() => api.shutdown(), 600);
        return;
      case "exit":
        api.close("terminal");
        return;
      default:
        out.push(t("term.badCommand").replace("{h}", head), t("term.promptHelp"));
    }
    setLines((l) => [...l, ...out, ""]);
    setInput("");
  };

  return (
    <div
      className="flex-1 min-h-0 bg-[#020a04] bevel-in p-2 overflow-auto font-mono text-[13px] text-phosphor text-glow leading-[1.5]"
      onClick={() => inputRef.current?.focus()}
    >
      {lines.map((l, i) => (
        <p key={i} className="whitespace-pre-wrap break-all">
          {l}
        </p>
      ))}
      <p className="flex items-center flex-wrap break-all">
        <span className="whitespace-pre">C:\NewBoy&gt;&nbsp;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") exec(input);
          }}
          spellCheck={false}
          autoComplete="off"
          aria-label={t("terminal.input")}
          className="flex-1 min-w-[4ch] bg-transparent outline-none text-phosphor caret-transparent"
        />
        <span className="cursor-blink inline-block w-[8px] h-[15px] bg-phosphor -ml-[8px] pointer-events-none" aria-hidden />
      </p>
      <div ref={endRef} />
    </div>
  );
}

// ── System monitor (a nod to Floor Monitor, resident bottom-right on the
// original site; here it opens on demand, unanchored) ────
// Anatomy copied from the original site: menu bar + right-aligned station tag / three
// action buttons / plain-text quota (no progress bar — the original is one line of
// text) / white table with thin gray grid, beveled headers and a sort arrow on the last
// column / right-aligned italic ticker / twin sunken status cells. Skin swapped from
// terminal green to Win95 silver-gray on white.

/** Process table: name / status / memory. The statuses "binding / hatching /
 *  processing / quarantined" are the honest progress of the site's sections and never
 *  flicker randomly — the monitor can perform, the progress doesn't lie. */
const PROCS: { name: string; statusKey: DictKey; mem: string; moody?: boolean }[] = [
  { name: "explorer.exe", statusKey: "monitor.running", mem: "4.2 MB", moody: true },
  { name: "scripts.dll", statusKey: "monitor.binding", mem: "1.2 MB" },
  { name: "lab.exe", statusKey: "monitor.hatching", mem: "8.8 MB" },
  { name: "imgtool.exe", statusKey: "monitor.processing", mem: "16 MB" },
  { name: "bugs.exe", statusKey: "monitor.isolated", mem: "0.6 MB" },
  { name: "coffee.sys", statusKey: "monitor.refueling", mem: "47%", moody: true },
  { name: "motivate.dll", statusKey: "monitor.pretending", mem: "0.3 MB", moody: true },
];

const MOODS: DictKey[] = ["monitor.running", "monitor.sleeping", "monitor.coffee", "monitor.pretending", "monitor.thinking", "monitor.slacking", "monitor.revived", "monitor.eating"];

/** Statuses that count as working (green in the table; the status-bar count uses this
 *  too). */
const AWAKE = new Set<DictKey>(["monitor.running", "monitor.revived", "monitor.refueling"]);

/** Deadpan ticker lines, one per 12 s (nodding to the original "the floor is
 *  live"). */
const TICKER_LINES: DictKey[] = ["monitor.ticker1", "monitor.ticker2", "monitor.ticker3", "monitor.ticker4"];

export function MonitorWindow() {
  const { t } = useI18n();
  const [tick, setTick] = useState(0);
  const [procs, setProcs] = useState(PROCS);
  const [quota, setQuota] = useState(0);

  // Heartbeat: one tick per 2 s. One random moody process changes mood + the CPU
  // column drifts wholesale + the quota creeps up.
  useEffect(() => {
    const t = setInterval(() => {
      setTick((n) => n + 1);
      setProcs((ps) => {
        const pool = ps.map((p, i) => (p.moody ? i : -1)).filter((i) => i >= 0);
        if (pool.length) {
          const i = pool[Math.floor(Math.random() * pool.length)];
          const next = [...ps];
          next[i] = { ...next[i], statusKey: MOODS[Math.floor(Math.random() * MOODS.length)] };
          return next;
        }
        return ps;
      });
      setQuota((q) => Math.min(q + Math.random() < 0.4 ? 1 : 0, 250));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const awake = procs.filter((p) => AWAKE.has(p.statusKey)).length;
  const coffee = 35 + ((tick * 7) % 60);
  const ticker = TICKER_LINES[Math.floor(tick / 6) % TICKER_LINES.length];

  // The three buttons are this monitor's only "control", and all they do is edit the
  // process table (the original site's gag).
  const setMoods = (statusKey: DictKey, bumpQuota = 0) => {
    setProcs((ps) => ps.map((p) => (p.moody ? { ...p, statusKey } : p)));
    if (bumpQuota) setQuota((q) => Math.min(q + bumpQuota, 250));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-chrome px-[6px] pt-0 pb-[2px] gap-[2px]">
      <MenuBar items={[t("monitor.menu.data"), t("monitor.menu.view"), t("monitor.menu.help")]} right="NewBoy · World" />
      <div className="flex gap-[3px]">
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-2 py-[2px] text-[11px] press"
          onClick={() => setMoods("monitor.revived", 6)}
        >
          {t("monitor.boost")}
        </button>
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-2 py-[2px] text-[11px] press"
          onClick={() => setMoods("monitor.running")}
        >
          {t("monitor.patrol")}
        </button>
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-2 py-[2px] text-[11px] press"
          onClick={() => setMoods("monitor.eating")}
        >
          {t("monitor.lunch")}
        </button>
      </div>
      <p className="text-[11px] leading-[1.3] text-black">
        {t("monitor.quota").replace("{quota}", String(quota)).replace("{pct}", String(Math.round((quota / 250) * 100)))}
      </p>
      <div className="flex-1 min-h-0 bg-white bevel-in overflow-auto">
        <table className="w-full text-[11px] leading-[1.3] text-black text-left border-collapse">
          <thead>
            <tr className="bg-chrome sticky top-0">
              <th className="fm-th">{t("monitor.process")}</th>
              <th className="fm-th">{t("monitor.status")}</th>
              <th className="fm-th text-right">CPU</th>
              <th className="fm-th text-right">{t("monitor.memory")}</th>
            </tr>
          </thead>
          <tbody>
            {procs.map((p, i) => (
              <tr key={p.name} className="border-b border-[#d4d0c8]">
                <td className="px-[6px] py-[1px] whitespace-nowrap">{p.name}</td>
                <td className={`px-[6px] py-[1px] whitespace-nowrap ${AWAKE.has(p.statusKey) ? "text-[#008000]" : ""}`}>
                  {t(p.statusKey)}
                </td>
                <td className="px-[6px] py-[1px] text-right text-black/60">
                  {(tick * 7 + i * 13) % 9}%
                </td>
                <td className="px-[6px] py-[1px] text-right whitespace-nowrap">{p.mem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-[1.3] italic text-black/50 text-right">{t(ticker)}</p>
      <StatusBar
        left={t("monitor.left").replace("{count}", String(procs.length)).replace("{awake}", String(awake)).replace("{seconds}", String(tick * 2))}
        right={t("monitor.right").replace("{coffee}", String(coffee))}
      />
    </div>
  );
}

// ── Run dialog ────────────────────────────────────────

const RUN_MAP: Record<string, string> = {
  terminal: "terminal",
  tools: "tools",
  media: "media",
  notes: "notes",
  monitor: "monitor",
  readme: "readme",
  mycomputer: "mycomputer",
  explorer: "mycomputer",
  imgtool: "imgtool",
  "imgtool.exe": "imgtool",
  hotaru: "hotaru",
  "02.jpg": "hotaru",
  "02.hotaru.jpg": "hotaru",
  aespu: "aespu",
  "aespu.mp4": "aespu",
  "13.mp4": "aespu",
  "13.ningen.mp4": "aespu",
  bin: "bin",
  paper: "paper",
  "paper.exe": "paper",
  文稿: "paper",
  nes: "nes",
  "nes.exe": "nes",
  famicom: "nes",
  红白机: "nes",
  mines: "mines",
  "mines.exe": "mines",
  winmine: "mines",
  "winmine.exe": "mines",
  扫雷: "mines",
  stickies: "stickies",
  "stickies.exe": "stickies",
  便签: "stickies",
  settings: "settings",
  "settings.exe": "settings",
  系统设置: "settings",
};

export function RunWindow() {
  const { t } = useI18n();
  const api = useDesktop();
  // Curation (doc 08 §1.2): hidden apps don't answer their run aliases for
  // visitors — aliases pointing at them drop out of the table wholesale.
  const ownerState = useOwnerState();
  const privacy = usePrivacyPrefs();
  const visitor = !ownerState.token || ownerState.preview;
  const runMap = visitor
    ? Object.fromEntries(Object.entries(RUN_MAP).filter(([, id]) => !privacy.hiddenApps.includes(id)))
    : RUN_MAP;
  const [value, setValue] = useState("");

  const run = () => {
    const target = runMap[value.trim().toLowerCase()];
    if (target) {
      api.open(target);
      api.close("run");
    } else {
      api.dialog(t("run.error"), [
        t("run.notFound").replace("{v}", value),
        t("run.confirm"),
      ]);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 p-2">
      <div className="flex gap-3">
        <PixelIcon sprite={ConsoleIcon} size={32} className="shrink-0 mt-1" />
        <label className="text-[12px] leading-[1.6] flex-1">
          {t("run.prompt")}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") run();
            }}
            spellCheck={false}
            autoComplete="off"
            className="mt-1 w-full bg-white bevel-thin-in px-2 py-[3px] text-[13px] outline-none"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press" onClick={run}>
          {t("settings.ok")}
        </button>
        <button
          type="button"
          className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
          onClick={() => api.close("run")}
        >
          {t("settings.cancel")}
        </button>
      </div>
    </div>
  );
}

// ── System properties ─────────────────────────────────

export function SysPropsWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  const rows: [string, string][] = [
    [t("props.system"), t("props.systemValue")],
    [t("props.registered"), t("props.registeredValue")],
    [t("props.processor"), t("props.processorValue")],
    [t("props.memory"), t("props.memoryValue")],
    [t("props.display"), t("props.displayValue")],
    [t("props.sound"), t("props.soundValue")],
    [t("props.space"), t("props.spaceValue")],
  ];
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 p-3">
      <div className="flex-1 bg-white bevel-in p-3 text-[12px] leading-[2]">
        {rows.map(([k, v]) => (
          <p key={k}>
            <span className="inline-block w-[72px] font-bold">{k}:</span>
            {v}
          </p>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
          onClick={() => api.close("sysprops")}
        >
          {t("settings.ok")}
        </button>
      </div>
    </div>
  );
}

// ── Shared dialog content ─────────────────────────────

export function DialogContent({
  lines,
  type = "error",
}: {
  lines: string[];
  type?: "error" | "info";
}) {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 p-3">
      <div className="flex gap-3 flex-1 items-start">
        {type === "error" ? <GlyphError size={32} /> : <GlyphInfo size={32} />}
        <div className="text-[12px] leading-[1.7]">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
