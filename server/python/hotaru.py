#!/usr/bin/env python3
"""
hotaru - convert any image into a retro medium look: CRT phosphor / miniDV / dreamcore haze.

All style parameters were measured from the app's reference image:
  Background base   rgb(32, 8, 3)     (user design value; ~#2D1D1A incl. bloom wash measured in-image)
  Red highlight     eva-red ~#E84418 range, hot core up to (255, 80, 45)
  Phosphor bloom    feeds warm channels only (R > G > B), radius ~0.8% of the frame width
  Scanlines         3px period, dark rows pulled down ~25%
  Grain             warm-tinted monochrome fine grain, sigma~10/255, slightly stronger in red
  Black lift        shadows never go below the background base; overall bimodal (big dark field + sparse red)
  Vignette          ~8%; slight overall soft focus

newboy-server private copy - source of truth lives in skill-lab/HypeBoyImgTool/hotaru/hotaru.py.
Invoked by the hotaru NestJS module as a single-file CLI (single input, -o outdir);
do not hand-edit here without syncing the lab copy.

Dependencies: pillow + numpy   (npm run python:setup)
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# ---- Default parameters (measured) ----------------------------------------------------------------
# Color schemes: stops = gradient map (shadows / low-mid / high-mid / highlights each take their own hue),
#           bloom = glow color; may also carry treatment overrides for the global curve and effects:
#           gamma/contrast or curve (explicit Lightroom-style tone-curve control points), tint (grade
#           opacity default), grain, sharpen, hsl (hue-keyed luma, Lightroom HSL-luminance style).
#           Multi-stop + partial transparency.
PALETTES = {
    "relic":    {"stops": [(0.0, (32, 8, 3)),   (0.35, (96, 22, 10)),  (0.7, (200, 64, 30)),  (1.0, (255, 150, 100))],
                 "bloom": (255, 140, 90), "hsl": [18, 10, -8, -28, -22, -30, -18, 6],
                 "en": "aged relic: dark red -> burnt red -> phosphor red -> orange glow (app native; hue-keyed luma: reds/phosphor lift, cool hues sink into the dark field)"},
    "pool":     {"stops": [(0.0, (4, 24, 30)),  (0.35, (18, 78, 88)),  (0.7, (120, 198, 204)), (1.0, (236, 255, 255))],
                 "bloom": (195, 250, 250), "curve": [(0, 0.03), (0.25, 0.27), (0.5, 0.57), (0.75, 0.83), (1, 1)], "tint": 0.82,
                 "sharpen": 0.2, "hsl": [-12, -8, -30, -25, 20, 8, -18, -15],
                 "en": "poolcore: ink teal -> deep water -> pale aqua -> ice white (airy curve, crisp tiles; hue-keyed luma: aqua/blue lift, greens/yellows sink)"},
    "omoide":   {"stops": [(0.0, (34, 12, 30)), (0.35, (98, 36, 82)),  (0.7, (232, 150, 190)), (1.0, (255, 238, 246))],
                 "bloom": (255, 222, 236), "curve": [(0, 0.06), (0.25, 0.28), (0.5, 0.55), (0.75, 0.79), (1, 0.98)], "tint": 0.82,
                 "grain": 11.0 / 255.0, "hsl": [6, 8, -18, -30, -12, -8, 4, 10],
                 "en": "2000s J-DV: dark plum -> berry -> sakura pink -> pink-white (faded milky DV curve with soft highlight roll-off; hue-keyed luma: skin/pinks lift, greens sink; tape grain)"},
    "liminal":  {"stops": [(0.0, (20, 22, 30)), (0.35, (76, 80, 94)),  (0.7, (192, 194, 202)), (1.0, (252, 250, 246))],
                 "bloom": (255, 252, 245), "curve": [(0, 0.09), (0.25, 0.33), (0.5, 0.58), (0.75, 0.80), (1, 0.97)], "tint": 0.80,
                 "grain": 9.0 / 255.0, "hsl": [-15, -15, -15, -10, 6, 8, -8, -12],
                 "en": "liminal milk-white: cold gray -> fog gray -> pale gray-blue -> milky white (heavy milky-black lift, flat fog curve; hue-keyed luma: cool lifts, warm sinks)"},
    "vapor":    {"stops": [(0.0, (26, 11, 46)), (0.35, (90, 24, 130)), (0.7, (240, 80, 190)), (1.0, (170, 240, 255))],
                 "bloom": (140, 245, 255), "curve": [(0, 0.05), (0.25, 0.22), (0.5, 0.52), (0.75, 0.80), (1, 1)], "tint": 0.80,
                 "grain": 12.0 / 255.0, "sharpen": 0.25, "hsl": [8, 12, -22, -38, 24, -14, 6, 14],
                 "en": "vaporwave: deep violet -> purple neon -> hot pink -> cyan glow (milky-black S curve; hue-keyed luma: greens/yellows sink into violet, cyans/pinks/skin lift; tape-grade grain)"},
    "eva":      {"stops": [(0.0, (34, 6, 30)), (0.35, (128, 26, 40)), (0.7, (244, 118, 48)), (1.0, (255, 232, 168))],
                 "bloom": (255, 150, 70), "curve": [(0, 0), (0.25, 0.20), (0.5, 0.5), (0.75, 0.80), (1, 1)], "tint": 0.78,
                 "grain": 14.0 / 255.0, "sharpen": 0.3, "hsl": [-46, -6, 15, 0, -11, -27, -22, -31],
                 "en": "EVA: violet-black -> maroon -> alert orange -> cream (temp+tint warm cast, 5-point S curve, hue-keyed luma, heavy grain)"},
}
BG = tuple(v / 255 for v in PALETTES["relic"]["stops"][0][1])
HOT = tuple(v / 255 for v in PALETTES["relic"]["stops"][-1][1])
TINT = 0.85                            # grade layer opacity: 15% of the original shows through, removes the "pasted-on" feel
PIVOT = 0.55                        # S-curve pivot
CONTRAST = 1.35                     # contrast gain (keeps the subject's mid-tone detail)
GAMMA = 1.15                        # toe lift
BLOOM_T = 0.40                      # bloom threshold: mid-high brightness is enough to start glowing
BLOOM_STRENGTH = 1.25               # inner glow (phosphor subject)
BLOOM_WASH = 0.50                   # second, wide environmental red wash (~200px falloff in reference image)
BLOOM_CH = (1.0, 0.55, 0.35)        # relic-mode bloom channel mix; other palettes see PALETTES
SOFT = 0.15                         # retro soft focus
GHOST = 0.15                        # subject ghosting strength (signal echo / phosphor afterglow; 0=off)
HAZE_R = 0.012                      # dreamcore veil soft-focus radius (fraction of frame width)
HAZE_LIFT = 0.25                    # black lift from the haze (milky feel)
SCAN_PERIOD = 3
SCAN_DARK = 0.25
GRAIN = 10.0 / 255.0
VIGNETTE = 0.12


def to_float(img: Image.Image) -> np.ndarray:
    if img.mode in ("RGBA", "LA", "PA"):
        a = np.asarray(img.convert("RGBA"), dtype=np.float32) / 255.0
        arr = a[..., :3] * a[..., 3:4] + np.array(BG) * (1.0 - a[..., 3:4])
        return np.clip(arr, 0, 1)
    return np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0


def blur(arr: np.ndarray, sigma: float) -> np.ndarray:
    h, w = arr.shape[:2]
    if sigma <= 0 or w < 4 or h < 4:
        return arr
    pil = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8))
    pil = pil.filter(ImageFilter.GaussianBlur(radius=sigma))
    return np.asarray(pil, dtype=np.float32) / 255.0


def gradient_lut(t: np.ndarray, stops) -> np.ndarray:
    """Multi-stop gradient map: interpolate color per channel along the stops from brightness t."""
    pos = np.array([s[0] for s in stops], dtype=np.float32)
    cols = np.array([s[1] for s in stops], dtype=np.float32) / 255.0
    out = np.empty(t.shape + (3,), dtype=np.float32)
    for c in range(3):
        out[..., c] = np.interp(t, pos, cols[:, c])
    return out


HSL_HUES = np.array([0, 30, 60, 120, 180, 240, 270, 300, 360], dtype=np.float32)  # LR 8 hue-band centers (red..magenta, wrapped)


def hsl_luma_shift(arr: np.ndarray, y: np.ndarray, vals) -> np.ndarray:
    """Lightroom HSL-luminance: darken/brighten luma by ORIGINAL hue, so pixels of the same brightness
    land in different gradient stops (EVA recipe: reds sink, yellows lift). Scaled by pixel saturation -
    neutrals keep their place; vals = 8 sliders -100..100 (red orange yellow green aqua blue purple magenta)."""
    mx = arr.max(-1)
    mn = arr.min(-1)
    d = mx - mn
    sat = d / (mx + 1e-6)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    hue6 = np.zeros_like(y)
    m = mx == r
    hue6[m] = ((g - b)[m] / (d[m] + 1e-6)) % 6
    m = (mx == g) & (d > 0)
    hue6[m] = (b - r)[m] / (d[m] + 1e-6) + 2
    m = (mx == b) & (d > 0)
    hue6[m] = (r - g)[m] / (d[m] + 1e-6) + 4
    shift = np.interp(hue6 * 60.0, HSL_HUES, list(vals) + [vals[0]])
    return np.clip(y * (1.0 + 0.7 * shift / 100.0 * sat), 0, 1)


def curve_apply(t: np.ndarray, pts) -> np.ndarray:
    """Tone curve through control points (in, out) in 0-1, monotone cubic Hermite (Fritsch-Butland
    slopes): smooth like a dragged Lightroom curve, but cannot overshoot past the points - no banding."""
    x = np.array([p[0] for p in pts], dtype=np.float32)
    v = np.array([p[1] for p in pts], dtype=np.float32)
    d = np.diff(v) / np.diff(x)
    m = np.zeros_like(v)
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, len(v) - 1):
        m[i] = 0.0 if d[i - 1] * d[i] <= 0 else (d[i - 1] * d[i]) / (d[i - 1] + d[i])
    k = np.clip(np.searchsorted(x, t, side="right") - 1, 0, len(x) - 2)
    s = np.clip((t - x[k]) / (x[k + 1] - x[k]), 0, 1)
    s2, s3 = s * s, s * s * s
    h00 = 2 * s3 - 3 * s2 + 1
    h10 = s3 - 2 * s2 + s
    h01 = -2 * s3 + 3 * s2
    h11 = s3 - s2
    dx = x[k + 1] - x[k]
    return np.clip(h00 * v[k] + h10 * dx * m[k] + h01 * v[k + 1] + h11 * dx * m[k + 1], 0, 1)


def grade(arr: np.ndarray, seed: int, invert: bool = False,
          glow: float = 1.0,
          ghost: float = GHOST,
          palette: str = "relic", tint: float = TINT,
          dv=None, dv_shift: int = 4,          # None=off "chroma"=DV original (blue-green grain) "original"=DV without green
          haze: float = 0.0,
          grain_scale: float = 1.0) -> np.ndarray:   # <1 = finer grain (video bitrate: noise is incompressible)
    h, w = arr.shape[:2]

    # 0) Palette resolution first: an entry may override treatment globals (curve/tint/grain/sharpen)
    #    or carry an "hsl" hue-keyed luma recipe
    if palette not in PALETTES and palette != "original":
        palette = "relic"
    graded = palette != "original"
    skin = PALETTES.get(palette, PALETTES["relic"])
    skin_bloom = np.array(skin["bloom"], dtype=np.float32) / 255.0
    relic = palette == "relic"
    grain_s = skin.get("grain", GRAIN) * grain_scale

    # 1) Luma -> grading curve: keep the subject's light/dark structure; shadows sink to the warm base, highlights push to the red core.
    #    Hue-keyed luma first (Lightroom HSL panel): reds/blues sink, yellows lift - same-brightness pixels
    #    land in different gradient stops depending on their original hue
    y = arr @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    if graded and skin.get("hsl"):
        y = hsl_luma_shift(arr, y, skin["hsl"])
    if invert:
        y = 1.0 - y
    if graded:
        # palette-level curve override: explicit control points ("curve", Lightroom-style) replace the
        # global gamma+contrast pair when present; otherwise the entry may override gamma/contrast
        t = np.clip(y, 0, 1)
        if skin.get("curve") is not None:
            t = curve_apply(t, skin["curve"])
        else:
            gamma = skin.get("gamma", GAMMA)
            contrast = skin.get("contrast", CONTRAST)
            t = t ** gamma
            t = np.clip((t - PIVOT) * contrast + PIVOT, 0, 1)
        # 2) Multi-stop gradient map + tint blend: dark/mid/light each take their own hue,
        #    the semi-transparent grade lets original colors show through - color is "grown", not "painted over"
        out = gradient_lut(t, skin["stops"])
        out = np.clip(arr * (1.0 - tint) + out * tint, 0, 1)
    else:
        # original-color mode: no grading, keep the original colors, only add the retro TV layer
        t = np.clip(y, 0, 1)
        out = arr.copy()

    # 3) Phosphor bloom: inner halo + wide environmental wash.
    #    In grading mode the glow uses the palette's bloom color; in original mode it uses the image's own color (blue content glows blue)
    mask = np.clip((t - BLOOM_T) / (1 - BLOOM_T), 0, 1) ** 1.3
    glow_src = mask[..., None] * (skin_bloom if graded else arr)
    inner = blur(glow_src, max(5.0, w * 0.014))
    wash = blur(glow_src, max(10.0, w * 0.030))
    add = np.clip((inner * BLOOM_STRENGTH + wash * BLOOM_WASH) * 0.35 * glow, 0, 1)
    out = 1.0 - (1.0 - np.clip(out, 0, 1)) * (1.0 - add)   # screen blend: phosphor saturation instead of hard clipping

    # 4) Soft focus (composite-video softness)
    out = np.clip(out * (1 - SOFT) + blur(out, 1.2) * SOFT, 0, 1)

    # 4.1) Palette output sharpening (LR-style edge enhance; the DV chain brings its own, so it is skipped there)
    sharpen = skin.get("sharpen", 0.0)
    if sharpen and not dv:
        out = np.clip(out + (out - blur(out, 1.5)) * sharpen, 0, 1)

    # 4.5) Subject ghost: blend in a faint copy shifted across the frame (signal echo / afterglow; flat backgrounds unaffected)
    if ghost > 0:
        dx = max(2, int(w * 0.006))          # auto offset: 0.6% of width to the right
        g = min(max(ghost, 0.0), 1.8)
        sx = abs(dx)
        if sx < w:
            echo = np.empty_like(out)
            if dx > 0:
                echo[:, sx:] = out[:, :-sx]
                echo[:, :sx] = out[:, :sx]
            else:
                echo[:, :-sx] = out[:, sx:]
                echo[:, -sx:] = out[:, -sx:]
            out = np.clip(out * (1.0 - g) + echo * g, 0, 1)

    # 4.6) Dreamcore haze veil (diffusion veil / Orton, highlight-driven): the sharp core is kept,
    #      a soft glowing copy is screened over it - the veil grows from highlights, shadows stay clear;
    #      black lift into milky haze + slight desaturation - "looking through a veil", not "out of focus"
    if haze > 0:
        s = min(haze, 1.0)
        soft = blur(out, max(3.0, w * HAZE_R))
        veiled = 1.0 - (1.0 - out) * (1.0 - soft)          # screen(original, softened copy)
        luma_w = 0.35 + 0.65 * np.clip(soft.mean(2, keepdims=True) * 1.4, 0, 1)
        amt = 0.8 * s * luma_w                             # thick veil on highlights, thin on shadows
        out = out * (1.0 - amt) + veiled * amt
        l = HAZE_LIFT * s                                  # milky black lift
        out = out * (1.0 - l) + l * 0.5
        gray = out.mean(2, keepdims=True)
        out = out * (1.0 - 0.15 * s) + gray * 0.15 * s     # slight desaturation

    # 5) Scanlines (a CRT display property; DV mode uses interlaced comb instead and skips this;
    #    with haze on the scanlines fade - the veil is light and should not be cut by hard lines)
    if not dv:
        rows = (np.arange(h) % SCAN_PERIOD) == SCAN_PERIOD - 1
        out[rows] *= (1.0 - SCAN_DARK * (1.0 - 0.3 * min(haze, 1.0)))

    # 6) Grain: fine warm-toned grain in normal mode; colored chroma noise in shadows (blue-green) in DV mode;
    #    grain settles when haze is on (no grit in the fog)
    rng = np.random.default_rng(seed)
    grain_amt = grain_s * (1.0 - 0.4 * min(haze, 1.0))
    if dv:
        noise = rng.normal(0.0, grain_s * 1.8, out.shape).astype(np.float32)
        # blue-green channel weighting + shadow weighting + one-sided clipping push out a cyan-green cast (real miniDV flavor);
        # with --dv original the weighting is neutral: keep the DV grain feel without the green cast
        chan_w = np.array([0.7, 1.0, 1.2] if dv == "chroma" else [1.0, 1.0, 1.0],
                          dtype=np.float32)
        shadow_w = np.clip(1.2 - out.mean(2, keepdims=True), 0.2, 1.2)
        out = np.clip(out + noise * chan_w * shadow_w, 0, 1)
    else:
        noise = rng.normal(0.0, grain_amt, out.shape).astype(np.float32)
        noise[..., 0] *= 1.15 if relic else 1.0
        out = np.clip(out + noise, 0, 1)

    # 7) Vignette
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((xx / w - 0.5) * 2) ** 2 + ((yy / h - 0.5) * 2) ** 2) / 1.414
    out *= (1.0 - VIGNETTE * np.clip(r, 0, 1) ** 2.5)[..., None]

    # 8) Format damage layer: the miniDV camcorder chain (the only modeled format)
    if dv:
        out = dv_effects(out, shift=dv_shift)

    return np.clip(out, 0, 1)


def _box_blur_axis(a: np.ndarray, k: int, axis: int) -> np.ndarray:
    """Box blur along a single axis (edge padding keeps the size, any ndim - used for chroma bleed,
    vertical smear, chrome streaks)."""
    if k < 2 or a.shape[axis] < k:
        return a
    pad_l = k // 2
    pad_r = k - 1 - pad_l
    width = [(0, 0)] * a.ndim
    width[axis] = (pad_l, pad_r)
    ap = np.pad(a, width, mode="edge")
    c = np.cumsum(ap, axis=axis, dtype=np.float32)
    zeros_shape = list(c.shape); zeros_shape[axis] = 1
    c = np.concatenate([np.zeros(zeros_shape, np.float32), c], axis=axis)
    sl_hi = [slice(None)] * a.ndim; sl_hi[axis] = slice(k, None)
    sl_lo = [slice(None)] * a.ndim; sl_lo[axis] = slice(None, -k)
    return (c[tuple(sl_hi)] - c[tuple(sl_lo)]) / k


def dv_effects(arr: np.ndarray, shift: int = 4) -> np.ndarray:
    """miniDV camcorder chain: low-res softening -> 4:1:1 horizontal chroma bleed -> edge enhancement ->
    interlaced comb -> vertical highlight smear."""
    h, w = arr.shape[:2]
    out = arr

    # 1) DV resolution softening: squeeze to ~720 wide then scale back (miniDV's physical horizontal resolution)
    tw = min(720, w)
    im = Image.fromarray(np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8))
    im = im.resize((tw, max(8, round(h * tw / w))), Image.BILINEAR)
    im = im.resize((w, h), Image.BICUBIC)
    out = np.asarray(im, dtype=np.float32) / 255.0

    # 2) 4:1:1 chroma bleed: blur the R/B-minus-luma difference signals horizontally, then add them back (red edges smear sideways).
    #    G is solved from luma: g = (0.7152*y - 0.2126*dr - 0.0722*db)/0.7152---
    #    y must first be multiplied back by 0.7152, otherwise G is lifted ~0.4x luma and the whole frame turns green
    y = out @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    dr, db = out[..., 0] - y, out[..., 2] - y
    k = max(3, w // 120)
    dr = _box_blur_axis(dr, k, 1)
    db = _box_blur_axis(db, k, 1)
    r = np.clip(y + dr, 0, 1)
    b = np.clip(y + db, 0, 1)
    g = np.clip((0.7152 * y - 0.2126 * dr - 0.0722 * db) / 0.7152, 0, 1)
    out = np.stack([r, g, b], axis=-1)

    # 3) Camcorder edge enhancement (mild unsharp overshoot)
    out = np.clip(out + (out - blur(out, 1.5)) * 0.45, 0, 1)

    # 4) Interlace comb: odd field shifted horizontally (paused 60i frame)
    if shift > 0:
        sx = min(shift, w // 8)
        odd = out[1::2]
        shifted = np.empty_like(odd)
        shifted[:, sx:] = odd[:, :-sx]
        shifted[:, :sx] = odd[:, :sx]
        out[1::2] = shifted

    # 5) CCD vertical smear of highlights (lamps / window light drag bright streaks downward)
    hot = np.clip((y - 0.82) / 0.18, 0, 1)
    streak = _box_blur_axis(hot, max(9, h // 60), 0)
    out = np.clip(out + (streak * 0.55)[..., None] * np.array([1.0, 0.95, 0.85]), 0, 1)

    return out


def process(path: str, out_path: str, seed: int, invert: bool,
            glow: float, ghost: float, palette: str, tint: float,
            dv=None, dv_shift: int = 4, haze: float = 0.0) -> None:
    img = Image.open(path)
    arr = to_float(img)
    arr = grade(arr, seed=seed, invert=invert,
                glow=glow, ghost=ghost, palette=palette, tint=tint,
                dv=dv, dv_shift=dv_shift, haze=haze)
    result = Image.fromarray((arr * 255.0 + 0.5).astype(np.uint8))
    if out_path.lower().endswith((".jpg", ".jpeg")):
        result.save(out_path, quality=92)
    else:
        result.save(out_path)
    print(f"{path} -> {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description="hotaru - retro medium style converter for photos (CRT/miniDV/dreamcore)")
    ap.add_argument("inputs", nargs="+", help="input files or directories")
    ap.add_argument("-o", "--outdir", help="output directory (defaults to the input's directory)")
    ap.add_argument("--suffix", default="hotaru", help="output filename suffix (default: hotaru)")
    ap.add_argument("--seed", type=int, default=7, help="random seed for grain/scratches (same seed reproduces the result)")
    ap.add_argument("--invert", action="store_true",
                    help="negative mode: invert lightness (off by default - the subject keeps its original look)")
    ap.add_argument("--palette", default="relic",
                    choices=["relic", "pool", "omoide", "liminal", "vapor", "eva", "original"],
                    help="palette (gradient map, concept naming): relic=aged dark red (default, app native) pool=poolcore "
                         "omoide=2000s J-DV liminal=milky-white vapor=vaporwave pink-purple-cyan "
                         "eva=Evangelion warm magenta-orange (hue-keyed luma + crushed blacks) "
                         "original=keep original colors, retro TV only")
    ap.add_argument("--tint", type=float, default=None,
                    help="grade layer opacity 0-1 (default: per palette, 0.85 for most - a slice of the original "
                         "shows through; 1=fully overlaid old feel)")
    ap.add_argument("--dv", nargs="?", const="chroma", default=None,
                    choices=["chroma", "original"],
                    help="miniDV camcorder mode: interlace comb + 4:1:1 chroma bleed + low-res softening + CCD highlight smear"
                         "+ colored shadow noise (replaces CRT scanlines);"
                         "optional value original=neutral noise without green cast (default chroma=blue-green chroma noise)")
    ap.add_argument("--dv-shift", type=int, default=4,
                    help="DV interlace comb shift in pixels (default 4; 0=disable comb)")
    ap.add_argument("--haze", type=float, default=0.0,
                    help="dreamcore haze veil 0-1 (default 0=off): sharp core + glowing soft veil + milky black lift;"
                         "0.3 tipsy / 0.5 standard dreamcore / 0.8 deep dream")
    ap.add_argument("--glow", type=float, default=1.0,
                    help="glow intensity multiplier (default 1.0; add more for brighter, e.g. --glow 1.5)")
    ap.add_argument("--ghost", type=float, default=GHOST,
                    help="ghosting strength 0-1 (default 0.15 slight ghosting; 0 = off)")
    args = ap.parse_args()
    tint = args.tint if args.tint is not None else PALETTES.get(args.palette, {}).get("tint", TINT)

    files = []
    for p in args.inputs:
        if os.path.isdir(p):
            files += sorted(
                os.path.join(p, f) for f in os.listdir(p)
                if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp"))
            )
        else:
            files.append(p)

    if not files:
        sys.exit("No image files found")

    for i, f in enumerate(files):
        stem, ext = os.path.splitext(os.path.basename(f))
        out_ext = ".png" if ext.lower() in (".bmp", ".webp") else ext
        outdir = args.outdir or os.path.dirname(f) or "."
        os.makedirs(outdir, exist_ok=True)
        out = os.path.join(outdir, f"{stem}.{args.suffix}{out_ext}")
        process(f, out, seed=args.seed + i, invert=args.invert,
                glow=args.glow, ghost=args.ghost,
                palette=args.palette, tint=tint,
                dv=args.dv, dv_shift=args.dv_shift, haze=args.haze)


if __name__ == "__main__":
    main()
