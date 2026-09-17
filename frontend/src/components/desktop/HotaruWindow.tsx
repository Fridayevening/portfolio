"use client";

// Image tool (IMGTOOL.EXE): local image → NewBoy-server hotaru developing → darkroom
// compare → download.
// Layout: left parameter panel (scrollable) + right darkroom compare (original/result)
// + bottom action row + status bar.
// The desktop imgtool icon's placeholder dialog ("the program itself is still
// developing") retires here — the monitor's "imgtool.exe processing" line is now true.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "./context";
import { CompareCell, FRAME_CLS, FRAME_SHADOW, MenuBar, StatusBar, PhotoWindow } from "./windows";
import { PhotoIcon, PixelIcon } from "./icons";
import { ApiError } from "@/lib/api/client";
import { processHotaruImage } from "@/lib/api/hotaru";
import type { HotaruImageOptions, HotaruPalette } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/LanguageContext";
import type { DictKey } from "@/lib/i18n/dict";

// ── Palettes: the gradient swatches' stops come straight from python/hotaru.py's
//    PALETTES ── real render colors, not decoration; original = no tint, shown as a
//    white swatch with a black diagonal hatch.
const PALETTES: { id: HotaruPalette; labelKey: DictKey; grad?: string }[] = [
  { id: "relic", labelKey: "hotaru.palette.relic", grad: "linear-gradient(90deg, #200803, #60160a 35%, #c8401e 70%, #ff9664)" },
  { id: "pool", labelKey: "hotaru.palette.pool", grad: "linear-gradient(90deg, #04181e, #124e58 35%, #78c6cc 70%, #ecffff)" },
  { id: "omoide", labelKey: "hotaru.palette.omoide", grad: "linear-gradient(90deg, #220c1e, #622452 35%, #e896be 70%, #ffeef6)" },
  { id: "liminal", labelKey: "hotaru.palette.liminal", grad: "linear-gradient(90deg, #14161e, #4c505e 35%, #c0c2ca 70%, #fcfaf6)" },
  { id: "vapor", labelKey: "hotaru.palette.vapor", grad: "linear-gradient(90deg, #1a0b2e, #5a1882 35%, #f050be 70%, #aaf0ff)" },
  { id: "eva", labelKey: "hotaru.palette.eva", grad: "linear-gradient(90deg, #22061e, #801a28 35%, #f47630 70%, #ffe8a8)" },
  { id: "original", labelKey: "hotaru.palette.original" },
];

type Params = {
  palette: HotaruPalette;
  ghost: number;
  glow: number;
  haze: number;
  tintAuto: boolean; // true = omit tint and let each palette's default take over (the only numeric field with "absent" semantics)
  tint: number;
  dv: "off" | "chroma" | "original";
  dvShift: number; // DV interlace comb shift in px; 0 disables the comb
  invert: boolean;
};

// Default taste hand-tuned around the ningen preset (not a snapshot); dvShift matches
// the server/CLI default of 4.
const DEFAULT_PARAMS: Params = {
  palette: "omoide",
  ghost: 1.8,
  glow: 1,
  haze: 0.25,
  tintAuto: false,
  tint: 0.25,
  dv: "chroma",
  dvShift: 4,
  invert: false,
};

const MAX_BYTES = 25 * 1024 * 1024; // the server's multer limit; the front end blocks early
// Fixed seats for the zoom-inspect windows: one for the original, one for the result —
// openDef opens idempotently; both can sit on the desktop at once, and no picture ever
// opens a second window of itself.
const VIEW = { orig: "imgtool-view-orig", out: "imgtool-view-out" } as const;

// ── Tailored chrome measurements for the zoom-inspect windows ──
// Every ring of the window frame must be subtracted so what remains is exactly the
// picture: win95 outer frame 2×2 + content margin 2×2 + darkroom padding 12×2 + photo
// frame border 3×2 = 38 horizontally; vertically add the 22px titlebar + 7px
// frame/margins + 8px gap above the caption + 20px status bar = 87; caption line height
// is counted separately (original: one line / result: two command lines).
const VIEW_CHROME_X = 38;
const VIEW_CHROME_Y = 87;
const VIEW_CAP_LINE = 18; // photo-cap 12.5px × 1.4 line-height, rounded up
const VIEW_MIN = { w: 320, h: 240 };
// Fallback when native size is unknown (anything clickable has onLoad'd by then in
// theory — kept as a floor).
const VIEW_FALLBACK = { w: 640, h: 480 };

/** Fits the window to the picture's native size: small images at 1:1, large ones scaled
 *  to fit; both window axes are clamped, and the caps are pulled in by the viewport
 *  again (40px breathing room on width; 36px taskbar + 44px breathing room on
 *  height). */
function fitViewerBox(nat: { w: number; h: number }, capLines: number) {
  const maxW = Math.min(1000, window.innerWidth - 40);
  const maxH = Math.min(760, window.innerHeight - 80);
  const padY = VIEW_CHROME_Y + capLines * VIEW_CAP_LINE;
  const s = Math.min(1, (maxW - VIEW_CHROME_X) / nat.w, (maxH - padY) / nat.h);
  return {
    w: Math.round(Math.min(Math.max(nat.w * s + VIEW_CHROME_X, VIEW_MIN.w), maxW)),
    h: Math.round(Math.min(Math.max(nat.h * s + padY, VIEW_MIN.h), maxH)),
  };
}
const randSeed = () => Math.floor(Math.random() * 2 ** 31); // server validates up to 2_147_483_647
// Step-accumulated float drift (0.30000000004) is rounded to 0.01 before sending or
// displaying.
const q2 = (v: number) => Math.round(v * 100) / 100;

/** Control values → request body. ghost/glow/haze/palette/dvShift are always sent
 *  explicitly: the server DTO fills omitted fields with its own defaults (ghost=0.15,
 *  palette=relic, …) — not ours — so omitting one would be lying. Only tint and the
 *  image-side dv truly carry "omitted = special semantics" (undefined = off). */
function buildOptions(p: Params, seed: number): HotaruImageOptions {
  const o: HotaruImageOptions = {
    palette: p.palette,
    seed,
    ghost: q2(p.ghost),
    glow: q2(p.glow),
    haze: q2(p.haze),
    dvShift: p.dvShift,
    invert: p.invert,
  };
  if (!p.tintAuto) o.tint = q2(p.tint);
  if (p.dv !== "off") o.dv = p.dv;
  return o;
}

/** Equivalent command line (the photo-cap footer): re-derived on every parameter change;
 *  anyone who knows can reproduce it locally. Order matches PhotoCompareWindow's
 *  existing caption. */
function buildCommand(p: Params, seed: number, fileName: string): string {
  const a = [`python hotaru.py ${fileName || "in.jpg"}`, `--ghost ${q2(p.ghost)}`, `--glow ${q2(p.glow)}`, `--haze ${q2(p.haze)}`];
  if (p.dv !== "off") a.push(p.dv === "chroma" ? "--dv" : "--dv original");
  a.push(`--dv-shift ${p.dvShift}`);
  a.push(`--palette ${p.palette}`);
  if (!p.tintAuto) a.push(`--tint ${q2(p.tint)}`);
  if (p.invert) a.push("--invert");
  a.push(`--seed ${seed}`);
  return a.join(" ");
}

/** The output extension comes from blob.type: the Python side has a bmp→png naming
 *  rule, so the input's extension can't be trusted. */
function extFromMime(mime: string, fallbackName: string): string {
  const byMime: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  if (byMime[mime]) return byMime[mime];
  const m = fallbackName.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "png";
}

/** ApiError → dialog lines: cancellation gets wrapped as "network" by the transport, so
 *  callers check signal.aborted before getting here. */
function hotaruErrorLines(err: unknown, t: (key: DictKey) => string): string[] {
  if (err instanceof ApiError) {
    if (err.kind === "offline")
      return [t("hotaru.error.offline1"), t("hotaru.error.offline2"), t("hotaru.error.offline3")];
    if (err.kind === "timeout") return [t("hotaru.error.timeout"), t("hotaru.error.retry")];
    if (err.kind === "network") return [t("hotaru.error.network"), t("hotaru.error.check")];
    if (err.status === 413) return [t("hotaru.error.large"), t("hotaru.error.limit")];
    if (err.status === 400) return [t("hotaru.error.rejected"), t("hotaru.error.params")];
    return [t("hotaru.error.server"), t("hotaru.error.negative").replace("{status}", String(err.status))];
  }
  return [t("hotaru.error.unknown"), String(err)];
}

// ── Win95 widgets (generalized from existing site precedents) ────────────

/** Win95 slider: bevel-thin-in track + navy fill. Feel copied from the MediaPlayer
 *  volume bar (pointer capture keeps pointermove hitting, e.buttons as a floor); the
 *  parameter sliders add keyboard. */
function Slider95({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  format?: (v: number) => string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const setFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    // Snap to step like the keyboard path does: the pointer is continuous, but a dragged
    // fractional dvShift (23.17) fails the server's @IsInt and 400s the whole request.
    const raw = min + t * (max - min);
    onChange(q2(min + Math.round((raw - min) / step) * step));
  };
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`flex flex-col gap-[3px] ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-baseline text-[11px]">
        <span>{label}</span>
        <span className="ml-auto tabular-nums text-black/60">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <div
        ref={trackRef}
        className="w-full h-[10px] bevel-thin-in bg-black/20 cursor-pointer touch-none"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons) setFromX(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onChange(q2(Math.max(min, value - step)));
          if (e.key === "ArrowRight") onChange(q2(Math.min(max, value + step)));
        }}
      >
        <div className="h-full bg-navy" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Square radio: 12px bevel-thin-in white swatch + a black dot when checked. The native
 *  input is only visually hidden (sr-only keeps it focusable), so label clicks and
 *  arrow-key group navigation come free — no hand-rolled radiogroup. */
function Radio95({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-[6px] text-[11px] leading-[1.6] cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only peer" />
      <span className="w-[12px] h-[12px] shrink-0 bevel-thin-in bg-white flex items-center justify-center peer-focus-visible:outline-1 peer-focus-visible:outline-dotted">
        {checked && <span className="w-[5px] h-[5px] rounded-full bg-black" />}
      </span>
      {children}
    </label>
  );
}

function Checkbox95({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-[6px] text-[11px] leading-[1.6] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span className="w-[12px] h-[12px] shrink-0 bevel-thin-in bg-white flex items-center justify-center peer-focus-visible:outline-1 peer-focus-visible:outline-dotted">
        {checked && <span className="text-[9px] leading-none font-bold">✓</span>}
      </span>
      {children}
    </label>
  );
}

/** Beveled group box: the legend rides the border — the orthodox Win95 dialog way. */
function GroupBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative bevel-thin-in mt-[10px] px-[8px] pt-[10px] pb-[8px] flex flex-col gap-[6px]">
      <span className="absolute -top-[7px] left-[6px] bg-chrome px-[4px] text-[11px] font-bold">{label}</span>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────

type Phase = "idle" | "ready" | "processing" | "done";

export default function HotaruWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [src, setSrc] = useState<{ file: File; url: string } | null>(null);
  const [out, setOut] = useState<{ url: string; ext: string } | null>(null);
  // Native sizes measured separately: developing can change a picture's height (DV
  // noise bands etc.), so the result never borrows the original's dimensions.
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [outNat, setOutNat] = useState<{ w: number; h: number } | null>(null);
  const dims = nat ? `${nat.w}×${nat.h}` : null;
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [seed, setSeed] = useState(() => randSeed());
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // objectURL revocation follows the value: swap image / swap result / close window —
  // all three paths are covered.
  useEffect(() => () => { if (src) URL.revokeObjectURL(src.url); }, [src]);
  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);
  // Closing the window aborts in-flight requests too — don't let Python run for nothing.
  useEffect(() => () => abortRef.current?.abort(), []);
  // Once the image tool closes, its objectURLs are all revoked and the zoom windows
  // hold broken images — close both. api.close itself goes into the deps: it's a stable
  // useCallback in Desktop, so this effectively runs once on unmount.
  const closeWin = api.close;
  useEffect(
    () => () => {
      closeWin(VIEW.orig);
      closeWin(VIEW.out);
    },
    [closeWin],
  );

  /** Zoom-window teardown: when the negative/result is about to be swapped, the old
   *  window still holds the old objectURL — a broken image once revoked. Close first;
   *  click again to view the new one (fixed seat ids, reopening never stacks
   *  windows). */
  function closeViewers(which: "out" | "both" = "out") {
    api.close(VIEW.out);
    if (which === "both") api.close(VIEW.orig);
  }

  /** Click a picture to open its zoom-inspect window: darkroom cells are thumbnail-sized,
   *  details need the big window. Windows are tailored to native size: small images at
   *  1:1, large ones capped (fitViewerBox) — no more fixed 640×480. The result window's
   *  footer is the equivalent command line: as long as it's open, the result hasn't been
   *  invalidated by parameter changes, and the footer always matches. Placement is right
   *  of the tool window (not burying its panel or buttons), pulled back in when the
   *  viewport can't fit it, by this window's own height and width. */
  function openViewer(kind: keyof typeof VIEW) {
    if (!src) return;
    const icon = <PixelIcon sprite={PhotoIcon} size={14} />;
    const pos = (bx: number, by: number, w: number, h: number) => ({
      x: Math.max(0, Math.min(bx, window.innerWidth - w - 16)),
      y: Math.max(0, Math.min(by, window.innerHeight - h - 44)), // 44 = taskbar + breathing room
    });
    if (kind === "out") {
      if (!out) return;
      const name = `${src.file.name.replace(/\.[^.]+$/, "")}.hotaru.${out.ext}`;
      // Two footer lines: the command is ~130 chars; only a near-1000px window fits it
      // on one line — budget for two.
      const size = outNat ? fitViewerBox(outNat, 2) : VIEW_FALLBACK;
      const p = pos(914, 150, size.w, size.h); // the result window steps down-right from the original's, so both can be viewed stacked
      api.openDef({
        id: VIEW.out,
        title: t("fs.preview").replace("{name}", name),
        icon,
        w: size.w,
        h: size.h,
        ...p,
        render: () => (
          <PhotoWindow
            src={out.url}
            file={name}
            dims={outNat ? `${outNat.w}×${outNat.h}` : dims ?? "…"}
            caption={buildCommand(params, seed, src.file.name)}
          />
        ),
      });
    } else {
      const size = nat ? fitViewerBox(nat, 1) : VIEW_FALLBACK;
      const p = pos(874, 90, size.w, size.h); // 70+780+24: hugging the tool window's right edge
      api.openDef({
        id: VIEW.orig,
        title: t("fs.preview").replace("{name}", src.file.name),
        icon,
        w: size.w,
        h: size.h,
        ...p,
        render: () => (
          <PhotoWindow
            src={src.url}
            file={src.file.name}
            dims={dims ?? "…"}
            caption={t("hotaru.originalCaption")}
          />
        ),
      });
    }
  }

  function loadFile(file: File | undefined | null) {
    if (!file) return;
    // Front-end checks before the network: 413 and bad extensions are caught locally,
    // no need to wait for the server.
    if (!/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
      api.dialog("HypeBoyImgTool", [t("hotaru.badType"), t("hotaru.allowedTypes")]);
      return;
    }
    if (file.size > MAX_BYTES) {
      api.dialog("HypeBoyImgTool", [t("hotaru.error.large"), t("hotaru.error.limit")]);
      return;
    }
    closeViewers("both"); // new negative: both zoom windows hold the old image's objectURLs — void now
    setOut(null);
    setOutNat(null);
    setNat(null); // old result and old sizes are void along with the old image
    setSrc({ file, url: URL.createObjectURL(file) });
    setPhase("ready");
    setNote("");
  }

  async function develop() {
    if (!src || phase === "processing") return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const s = randSeed(); // computed into a local first: setState is async, the new value isn't visible in this closure
    setSeed(s);
    setPhase("processing");
    setNote("");
    try {
      const blob = await processHotaruImage(src.file, buildOptions(params, s), { signal: ctrl.signal });
      closeViewers(); // tear down the old result's zoom window (if open): the new result gets viewed fresh
      setOutNat(null); // the new result's size gets measured by its own onLoad
      setOut({ url: URL.createObjectURL(blob), ext: extFromMime(blob.type, src.file.name) });
      setPhase("done");
    } catch (err) {
      // Cancellation gets wrapped as kind:"network" by the transport — check the signal
      // before assigning blame; cancellations show no error.
      if (ctrl.signal.aborted) {
        setPhase("ready");
        setNote(t("hotaru.cancelled"));
      } else {
        api.dialog(t("hotaru.failedTitle"), hotaruErrorLines(err, t));
        setPhase("ready");
        setNote(t("hotaru.failedNote"));
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  // Changing parameters = invalidating the result: one key back to ready, the right cell
  // returns to "pending". Everything funnels through this one place so the invalidation
  // logic can't leak (revoke is a side effect outside the pure updater — never inside).
  function patch(p: Partial<Params>) {
    setParams((prev) => ({ ...prev, ...p }));
    if (out) {
      closeViewers(); // The zoomed output closes when that output becomes invalid.
      URL.revokeObjectURL(out.url);
      setOut(null);
    }
    if (phase === "done") {
      setPhase("ready");
      setNote(t("hotaru.invalidated"));
    }
  }

  function saveOut() {
    if (!out || !src) return;
    const a = document.createElement("a");
    a.href = out.url; // the objectURL directly
    a.download = `${src.file.name.replace(/\.[^.]+$/, "")}.hotaru.${out.ext}`;
    a.click();
  }

  const statusText =
    phase === "idle"
      ? t("hotaru.status.idle")
      : phase === "ready"
        ? t("hotaru.status.ready")
        : phase === "processing"
          ? t("hotaru.status.processing")
          : t("hotaru.status.done");
  const statusLeft = [src?.file.name, dims, statusText, note || null].filter(Boolean).join(" · ");
  const busy = phase === "processing";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MenuBar
        items={[t("hotaru.menu.file"), t("hotaru.menu.process"), t("hotaru.menu.view"), t("hotaru.menu.help")]}
        right="IMGTOOL v1.0"
        extra={
          // The lab launch seat rides after Help, styled as a menu item so it reads as
          // part of the bar, not a foreign button.
          <button
            type="button"
            className="px-1 hover:bg-navy hover:text-white"
            onClick={() => api.open("imglab")}
          >
            {t("hotaru.lab")}
          </button>
        }
      />
      <div className="flex flex-1 min-h-0">
        {/* Left: parameter panel. Disabled wholesale while processing — otherwise a
            parameter change mid-flight would make the landing result mismatch its
            caption. */}
        <aside
          className={`w-[212px] shrink-0 bg-chrome bevel-in p-[8px] overflow-y-auto ${busy ? "opacity-50 pointer-events-none" : ""}`}
        >
          <GroupBox label={t("hotaru.palette")}>
            {PALETTES.map((p) => (
              <Radio95
                key={p.id}
                name="hotaru-palette"
                checked={params.palette === p.id}
                onChange={() => patch({ palette: p.id })}
              >
                {/* Gradient swatch: the real render colors from hotaru.py's PALETTES. */}
                <span
                  className="w-[22px] h-[11px] shrink-0 bevel-thin-in"
                  style={
                    p.grad
                      ? { background: p.grad }
                      : // original: white with black hatch — no tinting, only the
                        // retro-TV processing
                        {
                          background:
                            "repeating-linear-gradient(45deg, #fff 0 4px, #fff 4px, #0a0a0a 4px, #0a0a0a 5px)",
                        }
                  }
                />
                {t(p.labelKey)}
                <span className="text-black/40">{p.id}</span>
              </Radio95>
            ))}
          </GroupBox>

          <GroupBox label={t("hotaru.intensity")}>
            <Slider95 label={t("hotaru.ghost")} value={params.ghost} min={0} max={1.8} step={0.1} onChange={(v) => patch({ ghost: v })} format={(v) => v.toFixed(1)} />
            <Slider95 label={t("hotaru.glow")} value={params.glow} min={0} max={2} step={0.1} onChange={(v) => patch({ glow: v })} format={(v) => v.toFixed(1)} />
            <Slider95 label={t("hotaru.haze")} value={params.haze} min={0} max={1} step={0.05} onChange={(v) => patch({ haze: v })} format={(v) => v.toFixed(2)} />
          </GroupBox>

          <GroupBox label={t("hotaru.tint")}>
            <Checkbox95 checked={params.tintAuto} onChange={(v) => patch({ tintAuto: v })}>
              {t("hotaru.tintDefault")}
            </Checkbox95>
            {/* Checking "follow default" grays out the slider: the orthodox Win95
                dependent-control disable; the manual value is kept and returns on
                uncheck. */}
            <Slider95
              label={t("hotaru.opacity")}
              value={params.tint}
              min={0}
              max={1}
              step={0.05}
              disabled={params.tintAuto}
              onChange={(v) => patch({ tint: v })}
              format={(v) => (params.tintAuto ? t("hotaru.auto") : v.toFixed(2))}
            />
          </GroupBox>

          <GroupBox label={t("hotaru.standard")}>
            <Radio95 name="hotaru-dv" checked={params.dv === "off"} onChange={() => patch({ dv: "off" })}>
              <span className="text-black/40">DV</span>{t("hotaru.off")}
            </Radio95>
            <Radio95 name="hotaru-dv" checked={params.dv === "chroma"} onChange={() => patch({ dv: "chroma" })}>
              <span className="text-black/40">DV</span>{t("hotaru.chromaNoise")}
            </Radio95>
            <Radio95 name="hotaru-dv" checked={params.dv === "original"} onChange={() => patch({ dv: "original" })}>
              <span className="text-black/40">DV</span>{t("hotaru.originalNoise")}
            </Radio95>
            {/* With DV off the comb shift is moot — same dependent-control disable as
                "follow default". The 0-64 range matches the server DTO; 0 means the
                comb is off too. */}
            <Slider95
              label={t("hotaru.combShift")}
              value={params.dvShift}
              min={0}
              max={64}
              step={1}
              disabled={params.dv === "off"}
              onChange={(v) => patch({ dvShift: v })}
              format={(v) => (v === 0 ? t("hotaru.off") : `${v.toFixed(0)}px`)}
            />
            <Checkbox95 checked={params.invert} onChange={(v) => patch({ invert: v })}>
              {t("hotaru.invert")}
            </Checkbox95>
          </GroupBox>
        </aside>

        {/* Right: darkroom. Drop is always armed — dropping a new image in ready/done
            swaps it; ignored while processing. */}
        <div
          className={`flex-1 min-w-0 bg-[#55524a] bevel-in m-[3px] flex flex-col gap-[8px] p-[12px] overflow-hidden ${
            dragOver ? "outline-2 outline-dotted outline-[#ddd8c8]" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!busy) loadFile(e.dataTransfer.files[0]);
          }}
        >
          {src ? (
            <>
              <div className="flex-1 min-h-0 w-full flex items-stretch justify-center gap-[10px]">
                <CompareCell label={t("hotaru.original").replace("{name}", src.file.name)}>
                  {/* Static images skip next/image; the objectURL lifecycle is managed
                      here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src.url}
                    alt={src.file.name}
                    draggable={false}
                    onLoad={(e) =>
                      setNat({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                      })
                    }
                    onClick={() => openViewer("orig")}
                    title={t("hotaru.zoom")}
                    className={`${FRAME_CLS} cursor-zoom-in`}
                    style={FRAME_SHADOW}
                  />
                </CompareCell>
                <CompareCell label={t("hotaru.output")}>
                  {out ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={out.url}
                      alt={t("hotaru.resultAlt")}
                      draggable={false}
                      onLoad={(e) =>
                        setOutNat({
                          w: e.currentTarget.naturalWidth,
                          h: e.currentTarget.naturalHeight,
                        })
                      }
                      onClick={() => openViewer("out")}
                      title={t("hotaru.zoom")}
                      className={`${FRAME_CLS} cursor-zoom-in`}
                      style={FRAME_SHADOW}
                    />
                  ) : (
                    <div className="w-full h-full bevel-thin-in bg-black/25 flex items-center justify-center">
                      <span className="font-display text-[18px] text-[#ddd8c8]/70">
                        {busy ? (
                          <>
                            {t("hotaru.status.processing")}<span className="cursor-blink">_</span>
                          </>
                        ) : (
                          t("hotaru.pending")
                        )}
                      </span>
                    </div>
                  )}
                </CompareCell>
              </div>
              <p className="photo-cap text-center px-2 shrink-0">
                {buildCommand(params, seed, src.file.name)}
              </p>
            </>
          ) : (
            /* idle: the whole darkroom is the dropzone — drop or click to pick */
            <button
              type="button"
              className="flex-1 bevel-thin-in bg-black/20 flex flex-col items-center justify-center gap-[10px] outline-none"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="font-display text-[24px] text-[#ddd8c8]">{t("hotaru.drop")}</span>
              <span className="text-[11px] text-[#ddd8c8]/60">{t("hotaru.dropHint")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Action row. */}
      <div className="shrink-0 flex items-center justify-center gap-[10px] py-[4px]">
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press disabled:opacity-50 disabled:pointer-events-none"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          {t("hotaru.load")}
        </button>
        {busy ? (
          <button
            type="button"
            className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press"
            onClick={cancel}
          >
            {t("hotaru.cancel")}
          </button>
        ) : (
          <button
            type="button"
            className="bevel-thin-out bg-chrome px-6 py-[3px] text-[12px] font-bold press disabled:opacity-50 disabled:pointer-events-none"
            disabled={!src}
            onClick={() => void develop()}
          >
            Hype!
          </button>
        )}
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press disabled:opacity-50 disabled:pointer-events-none"
          disabled={phase !== "done"}
          onClick={saveOut}
        >
          {t("hotaru.save")}
        </button>
      </div>

      <StatusBar left={statusLeft} right={t("hotaru.imageSeed").replace("{seed}", String(seed))} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.bmp"
        className="sr-only"
        onChange={(e) => {
          loadFile(e.target.files?.[0]);
          e.target.value = ""; // cleared so the same file can be picked again
        }}
      />
    </div>
  );
}
