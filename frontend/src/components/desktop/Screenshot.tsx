"use client";

// Screenshot viewfinder (doc 07): an OS-level overlay, not a window. Full-screen dim
// with a ratio-locked crop frame; the shutter rasterizes .crt-screen through
// snapshot.ts (ShotOpts = honest snapshot), crops, optionally composites the CRT
// dressing, and hands the PNG to download/clipboard for social export.
// The overlay portals to document.body — never inside .crt-screen — so the viewfinder,
// dim and toolbar cannot leak into the captured subtree. z-[880]: above taskbar/
// start menu/paperclip, below the scanlines (the tube stays on top of everything,
// menus included).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { rasterizeElement, type ShotOpts } from "./snapshot";
import { CameraIcon, PixelIcon } from "./icons";
import { useI18n } from "../../lib/i18n/LanguageContext";

type RatioDef = { key: string; label: string; tw: number; th: number };
// tw/th = 0 → viewport aspect at ×2 (long edge capped 2560). One array = the whole
// ratio menu (doc 07 §3.2); adding a platform is adding a row.
const RATIOS: RatioDef[] = [
  { key: "full", label: "Full screen", tw: 0, th: 0 },
  { key: "1:1", label: "1:1", tw: 1080, th: 1080 },
  { key: "4:5", label: "4:5", tw: 1080, th: 1350 },
  { key: "4:3", label: "4:3", tw: 1440, th: 1080 },
  { key: "3:4", label: "3:4", tw: 1080, th: 1440 },
  { key: "16:9", label: "16:9", tw: 1920, th: 1080 },
  { key: "9:16", label: "9:16", tw: 1080, th: 1920 },
];

const FULL_CAP = 2560; // long-edge cap for the ×2 fullscreen export
const MIN_SIDE = 64;

type Rect = { x: number; y: number; w: number; h: number };
type Corner = "nw" | "ne" | "sw" | "se";

const SHOT_OPTS: ShotOpts = {
  copyCanvas: true,
  videoFrames: true,
  imgLive: true,
  mirrorForm: true,
  mirrorScroll: true,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Output pixels + raster scale for the current crop. Fixed ratios export at exact
 *  platform pixels; fullscreen doubles the viewport (capped). */
function targetOf(crop: Rect, def: RatioDef) {
  if (def.tw) return { tw: def.tw, th: def.th, scale: def.tw / crop.w };
  const long = Math.max(crop.w, crop.h);
  const f = Math.min(2, FULL_CAP / long);
  return { tw: Math.round(crop.w * f), th: Math.round(crop.h * f), scale: f };
}

/** Scanlines + vignette, parameters mirrored from .scanlines/.vignette in
 *  globals.css. Drawn at OUTPUT resolution — the tube goes with the photo, not with
 *  the screen's zoom. Black at 22% source-over ≡ the CSS multiply blend. */
function compositeCrt(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pat = document.createElement("canvas");
  pat.width = 1;
  pat.height = 3;
  const pctx = pat.getContext("2d")!;
  pctx.fillStyle = "rgba(0,0,0,0.22)";
  pctx.fillRect(0, 0, 1, 1);
  const pattern = ctx.createPattern(pat, "repeat");
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }
  // CSS `ellipse at center` ≈ unit-circle gradient scaled to the box.
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0.55, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

type Photo = { url: string; blob: Blob; w: number; h: number; name: string };

/** direct: the desk's 截图 icon opens with the shutter firing straight away —
 *  fullscreen, windows included, no framing pass. */
export default function Screenshot({ direct = false, onClose }: { direct?: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [bounds, setBounds] = useState<Rect | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [ratioKey, setRatioKey] = useState("full");
  const [crtOn, setCrtOn] = useState(true);
  const [phase, setPhase] = useState<"framing" | "developing" | "result">(direct ? "developing" : "framing");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [failed, setFailed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [tip, setTip] = useState("");

  const def = RATIOS.find((r) => r.key === ratioKey) ?? RATIOS[0];

  // Frame the whole screen on open; the rect (not (0,0) under glass mode's padding)
  // is the origin for every crop → raster coordinate map. Same measure-on-mount
  // shape as the desktop's vp state (SSR renders nothing).
  useLayoutEffect(() => {
    const measure = () => {
      const el = document.querySelector<HTMLElement>(".crt-screen");
      if (!el) {
        onClose();
        return;
      }
      const r = el.getBoundingClientRect();
      const b = { x: r.x, y: r.y, w: r.width, h: r.height };
      setBounds(b);
      setCrop(b);
    };
    measure();
  }, [onClose]);

  // Revoke the old object URL whenever a new photo develops or the overlay closes.
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  const shoot = useCallback(async () => {
    const el = document.querySelector<HTMLElement>(".crt-screen");
    if (!el || !bounds || !crop) return;
    setPhase("developing");
    setFailed(false);
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    const { tw, th, scale } = targetOf(crop, def);
    const raster = await rasterizeElement(el, scale, SHOT_OPTS);
    const out = document.createElement("canvas");
    out.width = tw;
    out.height = th;
    const ctx = out.getContext("2d");
    const blob =
      ctx &&
      raster &&
      new Promise<Blob | null>((res) => {
        const r = el.getBoundingClientRect();
        ctx.drawImage(
          raster,
          (crop.x - r.x) * scale,
          (crop.y - r.y) * scale,
          crop.w * scale,
          crop.h * scale,
          0,
          0,
          tw,
          th,
        );
        if (crtOn) compositeCrt(ctx, tw, th);
        out.toBlob(res, "image/png");
      });
    const b = await blob;
    if (!b) {
      setFailed(true);
      setPhase("result");
      return;
    }
    const d = new Date();
    const name = `NEWBOY_${pad2(d.getFullYear() % 100)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}.PNG`;
    setPhoto({ url: URL.createObjectURL(b), blob: b, w: tw, h: th, name });
    setPhase("result");
  }, [bounds, crop, def, crtOn]);

  const reshoot = useCallback(() => {
    setTip("");
    setFailed(false);
    setPhase("framing");
  }, []);

  // Direct mode: fire the fullscreen shutter as soon as the screen is measured.
  // The ref guard survives StrictMode's double-invoked effect — one shot, not two.
  const fired = useRef(false);
  useEffect(() => {
    if (!direct || fired.current || !bounds || !crop) return;
    fired.current = true;
    void shoot();
  }, [direct, bounds, crop, shoot]);

  const download = useCallback(() => {
    if (!photo) return;
    const a = document.createElement("a");
    a.href = photo.url;
    a.download = photo.name;
    a.click();
  }, [photo]);

  const copy = useCallback(async () => {
    if (!photo) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": photo.blob })]);
      setTip(t("shot.copied"));
    } catch {
      // No fake success (doc 04 §6 philosophy): the in-fiction line + the download.
      download();
      setTip(t("shot.downloaded"));
    }
  }, [photo, download]);

  // Modal keyboard: Enter shoots, Esc always backs out. Capture phase so the
  // underlying windows (e.g. an editor textarea that still holds focus) never see it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Enter" && phase === "framing") {
        e.preventDefault();
        e.stopPropagation();
        void shoot();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [phase, shoot, onClose]);

  // ── Frame drag: move + ratio-locked corner resize (Window95's capture pattern) ──
  const drag = useRef<{
    mode: "move" | Corner;
    px: number;
    py: number;
    box: Rect;
  } | null>(null);

  const startMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    drag.current = { mode: "move", px: e.clientX, py: e.clientY, box: crop };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const startResize = (corner: Corner) => (e: RPointerEvent<HTMLDivElement>) => {
    if (!crop) return;
    e.stopPropagation(); // the frame underneath would start a move drag
    drag.current = { mode: corner, px: e.clientX, py: e.clientY, box: crop };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: RPointerEvent<HTMLElement>) => {
    const s = drag.current;
    if (!s || !bounds) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (s.mode === "move") {
      setCrop({
        ...s.box,
        x: Math.min(Math.max(s.box.x + dx, bounds.x), bounds.x + bounds.w - s.box.w),
        y: Math.min(Math.max(s.box.y + dy, bounds.y), bounds.y + bounds.h - s.box.h),
      });
      return;
    }
    const east = s.mode.includes("e");
    const south = s.mode.includes("s");
    let w: number;
    let h: number;
    if (def.tw) {
      // Ratio locked: the dominant drag axis drives; the other follows.
      const ar = def.tw / def.th;
      const wDx = east ? s.box.w + dx : s.box.w - dx;
      const hDy = south ? s.box.h + dy : s.box.h - dy;
      w = Math.abs(dy) > Math.abs(dx) ? hDy * ar : wDx;
      h = w / ar;
    } else {
      // Fullscreen ratio is free: plain corner resize.
      w = east ? s.box.w + dx : s.box.w - dx;
      h = south ? s.box.h + dy : s.box.h - dy;
    }
    // Clamp the size against the bounds on both axes (shrink, never flip past the
    // pinned opposite corner), then pin that corner.
    const right = s.box.x + s.box.w;
    const bottom = s.box.y + s.box.h;
    const maxW = east ? bounds.x + bounds.w - s.box.x : right - bounds.x;
    const maxH = south ? bounds.y + bounds.h - s.box.y : bottom - bounds.y;
    w = Math.min(Math.max(w, MIN_SIDE), maxW);
    h = Math.min(Math.max(h, MIN_SIDE), maxH);
    if (def.tw) {
      const ar = def.tw / def.th;
      if (w / h > ar) w = h * ar;
      else h = w / ar;
    }
    setCrop({
      x: east ? s.box.x : right - w,
      y: south ? s.box.y : bottom - h,
      w,
      h,
    });
  };

  const endDrag = () => {
    drag.current = null;
  };

  /** Switch ratio: keep the center and the shorter visual axis, refit, clamp. */
  const pickRatio = (key: string) => {
    setRatioKey(key);
    const nd = RATIOS.find((r) => r.key === key);
    if (!nd || !bounds || !crop) return;
    if (!nd.tw) {
      setCrop(bounds);
      return;
    }
    const ar = nd.tw / nd.th;
    let w = crop.h * ar > bounds.w ? bounds.w : crop.h * ar;
    let h = w / ar;
    if (h > bounds.h) {
      h = bounds.h;
      w = h * ar;
    }
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    setCrop({
      w,
      h,
      x: Math.min(Math.max(cx - w / 2, bounds.x), bounds.x + bounds.w - w),
      y: Math.min(Math.max(cy - h / 2, bounds.y), bounds.y + bounds.h - h),
    });
  };

  const chip = (on: boolean) =>
    `px-[8px] py-[3px] text-[12px] bg-chrome press ${on ? "bg-navy text-white bevel-thin-in" : "bevel-thin-out"}`;

  if (!bounds || !crop) return null;

  const target = targetOf(crop, def);

  return createPortal(
    <div className="fixed inset-0 z-[880]" data-shot role="dialog" aria-label={t("shot.title")}>
      {phase !== "result" && (
        <>
          {/* Blocks every pointer to the desktop below; the dim itself is the frame's
              huge box-shadow so the cutout is always exact. */}
          <div className="absolute inset-0" />
          <div
            data-frame
            className="absolute cursor-move"
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.w,
              height: crop.h,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)",
              border: "1px dashed #fff",
              touchAction: "none",
            }}
            onPointerDown={startMove}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="absolute -top-[22px] left-0 max-w-full truncate bg-navy px-[6px] py-[1px] text-[11px] leading-[18px] text-white whitespace-nowrap select-none pointer-events-none">
              {target.tw} × {target.th}
              {def.tw ? ` · ${def.key === "full" ? t("shot.fullscreen") : def.label}` : ""}
            </div>
            {(["nw", "ne", "sw", "se"] as const).map((c) => (
              <div
                key={c}
                data-corner={c}
                className="absolute h-[10px] w-[10px] border border-black bg-white"
                style={{
                  left: c.includes("w") ? -6 : undefined,
                  right: c.includes("e") ? -6 : undefined,
                  top: c.includes("n") ? -6 : undefined,
                  bottom: c.includes("s") ? -6 : undefined,
                  cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                  touchAction: "none",
                }}
                onPointerDown={startResize(c)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            ))}
          </div>
        </>
      )}

      {phase === "framing" && (
        <div
          data-toolbar
          className="absolute bottom-[48px] left-1/2 -translate-x-1/2 flex items-center gap-[3px] bg-chrome bevel-out p-[3px] select-none"
        >
          {RATIOS.map((r) => (
            <button key={r.key} type="button" className={chip(r.key === ratioKey)} onClick={() => pickRatio(r.key)}>
              {r.key === "full" ? t("shot.fullscreen") : r.label}
            </button>
          ))}
          <div className="mx-[3px] w-[2px] self-stretch bevel-thin-in" />
          <button type="button" className={chip(crtOn)} onClick={() => setCrtOn((v) => !v)}>
            {crtOn ? "✓ " : ""}{t("shot.scanlines")}
          </button>
          <div className="mx-[3px] w-[2px] self-stretch bevel-thin-in" />
          <button
            type="button"
            className="bevel-thin-out bg-chrome press px-[14px] py-[3px] text-[12px] font-bold"
            onClick={() => void shoot()}
          >
            ◉ {t("shot.shoot")}
          </button>
          <button type="button" className={chip(false)} onClick={onClose}>
            {t("settings.cancel")}
          </button>
          <span className="ml-2 text-[10px] text-black/50 whitespace-nowrap">{t("shot.hint")}</span>
        </div>
      )}

      {phase === "developing" && (
        <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 bg-chrome bevel-out p-4">
          <PixelIcon sprite={CameraIcon} size={32} />
          <span className="text-[12px]">{t("shot.developing")}</span>
        </div>
      )}

      {phase === "result" && (
        <div className="absolute top-1/2 left-1/2 flex w-[400px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col bg-chrome bevel-out p-[3px]">
          <div className="titlebar-active flex h-[22px] shrink-0 items-center gap-1 pl-1 pr-[2px]">
            <PixelIcon sprite={CameraIcon} size={14} />
            <span className="flex-1 truncate text-[12px] font-bold text-white select-none">
              {t("shot.developed")}
            </span>
            <button type="button" aria-label={t("common.close")} className="winder" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="m-[2px] mt-[3px] flex flex-col gap-2 p-2">
            {failed || !photo ? (
              <p className="px-2 py-4 text-center text-[12px]">{t("shot.failed")}</p>
            ) : (
              <>
                <div className="bevel-thin-in flex max-h-[280px] min-h-[120px] items-center justify-center overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={t("shot.preview")}
                    className="max-h-[276px] max-w-full object-contain"
                    draggable={false}
                  />
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>{photo.name}</span>
                  <span>
                    {photo.w} × {photo.h} px
                  </span>
                </div>
              </>
            )}
            {tip && <div className="text-center text-[11px] text-black/60">{tip}</div>}
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                className="bevel-thin-out bg-chrome press px-4 py-[3px] text-[12px] font-bold"
                disabled={failed || !photo}
                onClick={download}
              >
                {t("shot.download")}
              </button>
              <button
                type="button"
                className="bevel-thin-out bg-chrome press px-4 py-[3px] text-[12px]"
                disabled={failed || !photo}
                onClick={() => void copy()}
              >
                {t("shot.copy")}
              </button>
              <button type="button" className="bevel-thin-out bg-chrome press px-4 py-[3px] text-[12px]" onClick={reshoot}>
                {t("shot.reshoot")}
              </button>
              <button type="button" className="bevel-thin-out bg-chrome press px-4 py-[3px] text-[12px]" onClick={onClose}>
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {flash && <div className="shot-flash fixed inset-0 bg-white" aria-hidden />}
    </div>,
    document.body,
  );
}
