#!/usr/bin/env python3
"""Generate the laser-card textures for the Blender scene (run with the server venv:
.venv/bin/python laser_textures.py <photo> [-o outdir]). Same design language as the
three.js prototype: card face (white border + rounded photo window + caption), card
back, aurora backdrop.

newboy-server private copy - source of truth lives in
skill-lab/HypeBoyImgTool/laser-card-blender/gen_textures.py.
Invoked by the lab NestJS module as a single-file CLI (single input, -o outdir);
do not hand-edit here without syncing the proto copy.

Dependencies: pillow + numpy   (npm run python:setup)
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

CW, CH = 700, 980
M, R_PHOTO = 26, 20
OUT = __file__.rsplit("/", 1)[0]


def font(size):
    for p in ("/System/Library/Fonts/Menlo.ttc",
              "/System/Library/Fonts/SFMono-Regular.ttf",
              "/System/Library/Fonts/Monaco.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def round_rect(d, box, r, **kw):
    d.rounded_rectangle(box, radius=r, **kw)


def card_face(photo_path):
    card = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    round_rect(d, (0, 0, CW, CH), 34, fill=(247, 244, 240, 255))

    win = (M, M, CW - M, CH - M - 64)
    ww, wh = win[2] - win[0], win[3] - win[1]
    photo = ImageOps.exif_transpose(Image.open(photo_path)).convert("RGB")
    arr = np.asarray(photo, np.float32) / 255.0

    # content-aware crop: black-void inputs (AI plates, renders, studio shots) would cover-
    # crop into a mostly-black window with a sliver of subject — trim the dark margins first
    # (before the median lift, or a median of 0 washes the whole frame gray)
    gray = arr.mean(-1)
    ys, xs = np.where(gray > 0.05)
    if len(xs) > 200:
        pad = int(max(photo.size) * 0.03)
        x0, x1 = max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad, photo.width)
        y0, y1 = max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad, photo.height)
        if (x1 - x0) > photo.width * 0.2 and (y1 - y0) > photo.height * 0.2 and \
           ((x1 - x0) < photo.width * 0.93 or (y1 - y0) < photo.height * 0.93):
            photo = photo.crop((x0, y0, x1, y1))
            arr = np.asarray(photo, np.float32) / 255.0

    # dark-photo rescue: a moody shot (black suit, black bg) cover-cropped reads as a black
    # card with one white stripe — percentile stretches get fooled by a small bright area,
    # so lift by MEDIAN: gamma that pulls the median to ~0.35 (print-friendly midtone)
    med = float(np.median(arr))
    if 0.0 < med < 0.25:
        gamma = max(0.3, min(1.0, np.log(0.35) / np.log(max(med, 0.02))))
        arr = arr ** gamma
        photo = Image.fromarray((np.clip(arr * 255, 0, 255)).astype(np.uint8))

    s = max(ww / photo.width, wh / photo.height)
    photo = photo.resize((round(photo.width * s), round(photo.height * s)), Image.LANCZOS)
    cx = (photo.width - ww) // 2
    cy = (photo.height - wh) * 30 // 100                     # bias up: keep heads in frame
    photo = photo.crop((cx, cy, cx + ww, cy + wh))           # cover-crop to the window
    mask = Image.new("L", (ww, wh), 0)
    round_rect(ImageDraw.Draw(mask), (0, 0, ww, wh), R_PHOTO, fill=255)
    card.paste(photo, (win[0], win[1]), mask)

    d = ImageDraw.Draw(card)
    f1, f2 = font(22), font(18)
    d.text((M + 6, CH - 62), "NEWBOY · LASER ED.", font=f1, fill=(40, 30, 50, 190))
    tw = d.textlength("№ 001 / 100", font=f2)
    d.text((CW - M - 6 - tw, CH - 60), "№ 001 / 100", font=f2, fill=(40, 30, 50, 115))
    card.save(f"{OUT}/card_face.png")


def backdrop(w=900, h=900):
    """Light sweep for the STILL render (matches web's 亮毯 preset): the glass shell only
    reads as a shape when the background has brightness to refract — lavender-gray pool,
    bright center fading darker to the edges."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h * 0.44) / (h / 2)) ** 2)
    stops = np.array([(216, 210, 228), (178, 172, 196), (133, 128, 154)], np.float32)
    # the 10x10 backdrop plane is framed to its central ~60%: pull the stops inside the
    # visible radius or the dark falloff never enters the picture (corners stayed ~223)
    pos = np.array([0.0, 0.38, 0.77])
    img = np.stack([np.interp(d, pos, stops[:, c]) for c in range(3)], -1)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(f"{OUT}/backdrop.png")


def card_back():
    back = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    d = ImageDraw.Draw(back)
    round_rect(d, (0, 0, CW, CH), 34, fill=(23, 19, 32, 255))
    bar = np.zeros((16, CW - 120, 4), np.uint8)
    grad = np.linspace(0, 1, bar.shape[1])
    for c, stops in [(0, (243, 166, 213)), (1, (141, 123, 255)), (2, (127, 232, 255))]:
        bar[..., c] = (stops[0] * (1 - grad) + stops[2] * grad).astype(np.uint8)
    bar[..., 3] = 230
    back.paste(Image.fromarray(bar), (60, CH // 2 - 8))
    f = font(26)
    t = "N E W B O Y"
    d.text(((CW - d.textlength(t, font=f)) / 2, CH / 2 - 86), t, font=f, fill=(255, 255, 255, 150))
    back.save(f"{OUT}/card_back.png")


def aurora_bg(w=512, h=1024):
    """The environment IS the aurora: pink->violet->cyan diagonal gradient + soft color pools."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    yy /= max(w, h); xx /= max(w, h)
    t = np.clip(0.28 * xx + 0.9 * yy, 0, 1)
    stops = np.array([(255, 143, 200), (169, 139, 255), (110, 168, 255), (127, 242, 255)], np.float32)
    pos = np.array([0.0, 0.35, 0.65, 1.0])
    img = np.stack([np.interp(t, pos, stops[:, c]) for c in range(3)], -1)

    rng = np.random.default_rng(42)
    for _ in range(26):
        cx, cy = rng.uniform(0, 1, 2)
        r = rng.uniform(0.06, 0.22)
        # hue sampled along the aurora arc: pink 255 -> violet 285 -> blue/cyan 330 (0-360 scale)
        hue = rng.uniform(255, 330)
        col = np.array([
            np.interp(hue, [255, 285, 330], [255, 190, 130]),   # R
            np.interp(hue, [255, 285, 330], [143, 115, 200]),   # G
            np.interp(hue, [255, 285, 330], [200, 255, 255]),   # B
        ], np.float32)
        g = np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * r * r)))
        for c in range(3):
            img[..., c] += g * col[c] * 0.55

    img = np.clip(img, 0, 255).astype(np.uint8)
    Image.fromarray(img).filter(ImageFilter.GaussianBlur(6)).save(f"{OUT}/aurora_bg.png")


if __name__ == "__main__":
    import argparse
    import os
    ap = argparse.ArgumentParser(description="generate laser-card textures")
    ap.add_argument("photo", help="input photo for the card face")
    ap.add_argument("-o", "--outdir", help="write textures here (default: script directory)")
    args = ap.parse_args()
    if args.outdir:
        os.makedirs(args.outdir, exist_ok=True)
        OUT = os.path.abspath(args.outdir)   # rebind the module-level default
    card_face(args.photo)
    card_back()
    aurora_bg()
    backdrop()
    print("textures ->", OUT, f"(photo: {args.photo})")
