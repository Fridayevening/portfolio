#!/usr/bin/env python3
"""
hotaru_video - hotaru retro-medium grading for video: miniDV camcorder / CRT palettes.

Reuses hotaru.py's per-frame pipeline (grade) unchanged: it is deterministic per frame,
so nothing flickers. Only the random layers get a time axis:
  grain      per-frame seed -> living noise, like real tape (per-image seed made it static)
  dropout    NEW: single-frame bright line flashes (tape read error), ~1 per 2 s at 1.0
  afterglow  optional previous-frame persistence (phosphor tail on moving highlights)
Damage model is DV-only, per design.

Reading/writing is PyAV; the audio track is copied without re-encoding (AAC fallback if the
source codec does not fit the container). Phone rotation metadata is baked in via ffprobe
(PyAV does not expose the display matrix).

newboy-server private copy - source of truth lives in skill-lab/hotaru/hotaru_video.py.
Invoked by the hotaru NestJS module as a single-file CLI (single input, -o outdir);
progress goes to stdout as "  <name>: frame n/total (p%), R fps, eta Ns" lines (flushed,
parsed by the service). Do not hand-edit here without syncing the lab copy.

Dependencies: av (PyAV) + pillow + numpy + ffprobe on PATH   (npm run python:setup)
"""

import argparse
import os
import subprocess
import sys
import time
from collections import deque
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # 'import hotaru' also works inside spawn workers
import hotaru as H

try:
    import av
except ImportError:
    sys.exit("PyAV is required:  .venv/bin/pip install av")

VIDEO_EXTS = (".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".mpg", ".mpeg", ".ts")
DROP_P = 0.021          # dropout event probability per frame at strength 1.0 (~1 per 2 s at 24 fps)


# ---- per-frame grading (worker side; pure function of the frame index) ------------------------------

def dv_dropout(arr: np.ndarray, seed: int, idx: int, strength: float) -> np.ndarray:
    """Tape dropout: 1-2 bright horizontal lines for exactly ONE frame (a read error on the
    tape, gone on the next field). Its own rng stream, independent of the grain seed."""
    rng = np.random.default_rng((seed * 1_000_003 + idx * 7919) & 0xFFFFFFFF)
    if rng.random() >= DROP_P * strength:
        return arr
    h, w = arr.shape[:2]
    n = int(rng.integers(1, 3))
    y = int(rng.integers(0, max(1, h - n)))
    if rng.random() < 0.75:
        x0, x1 = 0, w                      # full width
    else:
        x0 = int(rng.integers(0, max(1, w // 2)))
        x1 = min(w, x0 + int(rng.integers(max(2, w // 4), w)))
    add = (0.5 + 0.4 * rng.random()) * np.array(
        (1.0, 1.0, 1.0) if rng.random() < 0.5 else (1.0, 0.92, 0.82), np.float32)  # neutral / warm flash
    out = arr.copy()
    out[y:y + n, x0:x1] = np.clip(out[y:y + n, x0:x1] + add, 0, 1)
    return out


def grade_frame(rgb8: np.ndarray, idx: int, o: dict) -> np.ndarray:
    """One frame through the hotaru pipeline. seed=seed+idx -> grain redraws every frame."""
    arr = rgb8.astype(np.float32) / 255.0
    arr = H.grade(arr, seed=o["seed"] + idx, invert=o["invert"],
                  glow=o["glow"], ghost=o["ghost"], palette=o["palette"], tint=o["tint"],
                  dv=o["dv"], dv_shift=o["dv_shift"], haze=o["haze"],
                  grain_scale=o["grain"])
    if o["dropout"] > 0:
        arr = dv_dropout(arr, o["seed"], idx, o["dropout"])
    return (np.clip(arr, 0, 1) * 255.0 + 0.5).astype(np.uint8)


def _worker(job):
    idx, rgb8, o = job
    return idx, grade_frame(rgb8, idx, o)


# ---- container side helpers -------------------------------------------------------------------------

def rotation_deg(path: str) -> int:
    """Orientation of phone videos lives in display-matrix metadata, which PyAV does not expose.
    One ffprobe call; 0 when ffprobe is missing or nothing is set."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream_side_data=rotation", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=15)
        vals = [t for t in r.stdout.replace(",", " ").split() if t.strip()]
        if not vals:
            return 0
        deg = int(round(float(vals[0]))) % 360
        return deg if deg in (90, 180, 270) else 0
    except Exception:
        return 0


def rotate_frame(rgb8: np.ndarray, deg: int) -> np.ndarray:
    """Bake the display rotation into the pixels (ffprobe rotation = degrees clockwise)."""
    k = {90: -1, 180: 2, 270: 1}.get(deg)  # np.rot90 is counter-clockwise
    return rgb8 if k is None else np.ascontiguousarray(np.rot90(rgb8, k))


def convert(path: str, out_path: str, args, pool) -> None:
    inc = av.open(path)
    vs = next((s for s in inc.streams if s.type == "video"), None)
    if vs is None:
        inc.close()
        print(f"{path}: no video stream, skipped")
        return
    deg = rotation_deg(path)
    fps = vs.average_rate or vs.codec_context.framerate or Fraction(24, 1)
    # total frame estimate for progress: stream duration (in stream time_base) is the reliable
    # one; container.duration is AV_TIME_BASE microseconds in recent PyAV
    dur = float(vs.duration) * float(vs.time_base) if vs.duration else None
    if not dur and inc.duration:
        d = float(inc.duration)
        dur = d / 1_000_000 if d > 3600 else d
    total = round(dur * float(fps)) if dur else None
    opts = {"seed": args.seed, "invert": args.invert, "glow": args.glow, "ghost": args.ghost,
            "palette": args.palette, "tint": args.tint, "dv": None if args.dv == "off" else args.dv,
            "dv_shift": args.dv_shift, "haze": args.haze, "dropout": args.dropout,
            "grain": args.grain}
    ag = args.afterglow

    outc = av.open(out_path, "w")

    # ALL output streams must exist before the first mux (the header is written lazily on the
    # first packet - a stream added after that never gets a time base -> "Cannot rebase to zero
    # time"). Video dimensions come from the input codec context, not a decoded frame: the
    # demux loop interleaves audio, which may mux before any video frame shows up.
    w, h = vs.codec_context.width, vs.codec_context.height
    if deg in (90, 270):
        w, h = h, w
    # fit inside the (--width, --height) box: downscale only, aspect kept. Width alone cannot
    # tame portrait video (1080x1920 at --width 480 is still 480x854) - cap the height too
    scale = min((args.width / w) if args.width and w > args.width else 1.0,
                (args.height / h) if args.height and h > args.height else 1.0)
    if scale < 1.0:
        w, h = max(2, round(w * scale)), max(2, round(h * scale))
    w, h = w - w % 2, h - h % 2                      # yuv420p needs even dimensions
    vstream = outc.add_stream(args.encoder, rate=fps)
    vstream.width, vstream.height, vstream.pix_fmt = w, h, "yuv420p"
    if args.encoder == "h264_videotoolbox":
        vstream.bit_rate = args.vbitrate
    else:
        vstream.options = {"crf": str(args.crf), "preset": args.preset}

    # audio: template copy first (same codec into the new container); AAC re-encode as fallback
    astream = next((s for s in inc.streams if s.type == "audio"), None)
    a_out, a_recode = None, False
    if astream is not None:
        try:
            a_out = outc.add_stream_from_template(astream)
        except Exception:
            try:
                a_out = outc.add_stream("aac", rate=astream.codec_context.sample_rate or 48000)
                a_recode = True
            except Exception:
                print(f"{path}: audio not supported, continuing without it")

    submit = (lambda job: pool.submit(_worker, job)) if pool else (
        lambda job: _Immediate(_worker(job)))

    jobs, max_inflight = deque(), (args.procs if pool else 1) + 2
    prev, n_done, t0, last_prog = None, 0, time.time(), 0.0
    idx = 0

    def handle(idx_, out8):
        nonlocal prev
        if ag > 0:                              # phosphor tail: screen-blend the previous frame
            cur = out8.astype(np.float32) / 255.0
            if prev is not None:
                cur = 1.0 - (1.0 - cur) * (1.0 - np.clip(prev * ag, 0, 1))
            prev = cur
            out8 = (cur * 255.0 + 0.5).astype(np.uint8)
        for pkt in vstream.encode(av.VideoFrame.from_ndarray(out8, format="rgb24")):
            outc.mux(pkt)

    for packet in inc.demux():
        if packet.stream.type == "video":
            for frame in packet.decode():
                arr = frame.to_ndarray(format="rgb24")
                if deg:
                    arr = rotate_frame(arr, deg)
                if (arr.shape[1], arr.shape[0]) != (w, h):    # pre-scale into the target box
                    arr = np.asarray(Image.fromarray(arr).resize((w, h), Image.BILINEAR))
                if arr.shape[0] % 2 or arr.shape[1] % 2:      # yuv420p needs even dimensions
                    arr = arr[:arr.shape[0] - arr.shape[0] % 2, :arr.shape[1] - arr.shape[1] % 2]
                jobs.append(submit((idx, arr, opts)))
                idx += 1
                if len(jobs) >= max_inflight:
                    handle(*jobs.popleft().result())
                    n_done += 1
                    if time.time() - last_prog > 0.5:
                        last_prog = time.time()
                        _progress(path, n_done, total, t0)
        elif packet.stream.type == "audio" and a_out is not None:
            if a_recode:
                for aframe in packet.decode():
                    for pkt in a_out.encode(aframe):
                        outc.mux(pkt)
            else:
                if packet.dts is None:
                    continue
                packet.stream = a_out
                outc.mux(packet)
    while jobs:
        handle(*jobs.popleft().result())
        n_done += 1
    _progress(path, n_done, total, t0)
    for pkt in vstream.encode():
        outc.mux(pkt)
    if a_out is not None and a_recode:
        for pkt in a_out.encode():
            outc.mux(pkt)
    outc.close()
    inc.close()
    rate = n_done / max(time.time() - t0, 0.001)
    print(f"\r{path} -> {out_path}  ({idx} frames, {rate:.1f} fps)")


class _Immediate:
    """Sequential stand-in for a Future so `--procs 1` skips the pool entirely."""
    def __init__(self, result_):
        self._r = result_
    def result(self):
        return self._r


def _progress(path: str, n: int, total, t0: float) -> None:
    done = f"{n}/{total} ({100 * n / total:.0f}%)" if total else f"{n}"
    eta = f", eta {(total - n) * (time.time() - t0) / n:.0f}s" if total and n else ""
    print(f"\r  {os.path.basename(path)}: frame {done}, "
          f"{n / max(time.time() - t0, 0.001):.1f} fps{eta}   ", end="", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="hotaru_video - retro medium style converter for video (miniDV / CRT palettes, audio kept)")
    ap.add_argument("inputs", nargs="+", help="input video files or directories")
    ap.add_argument("-o", "--outdir", help="output directory (defaults to the input's directory)")
    ap.add_argument("--suffix", default="hotaru", help="output filename suffix (default: hotaru)")
    ap.add_argument("--seed", type=int, default=7, help="random seed (same seed reproduces the result exactly)")
    # grading flags: same names and defaults as hotaru.py
    ap.add_argument("--invert", action="store_true", help="negative mode: invert lightness")
    ap.add_argument("--palette", default="relic",
                    choices=["relic", "pool", "omoide", "liminal", "vapor", "eva", "original"],
                    help="palette (gradient map), same as hotaru.py (default: relic)")
    ap.add_argument("--tint", type=float, default=None, help="grade layer opacity 0-1 (default: per palette)")
    ap.add_argument("--glow", type=float, default=1.0, help="glow intensity multiplier (default 1.0)")
    ap.add_argument("--ghost", type=float, default=H.GHOST, help="ghosting strength 0-1.8 (default 0.15)")
    ap.add_argument("--haze", type=float, default=0.0, help="dreamcore haze veil 0-1 (default 0)")
    # DV (video defaults to the camcorder chain on - that is this tool's medium)
    ap.add_argument("--dv", nargs="?", const="chroma", default="chroma",
                    choices=["chroma", "original", "off"],
                    help="miniDV camcorder chain: interlace comb + 4:1:1 chroma bleed + low-res softening "
                         "+ CCD smear (default chroma = blue-green shadow noise; original = neutral; off = skip)")
    ap.add_argument("--dv-shift", type=int, default=4, help="interlace comb shift in pixels (default 4; 0=off)")
    # temporal-only effects
    ap.add_argument("--dropout", type=float, default=0.8,
                    help="tape dropout strength 0-5 (default 0.8 subtle, ~1 flash / 2.5 s; 0 = off)")
    ap.add_argument("--afterglow", type=float, default=0.0,
                    help="previous-frame persistence 0-0.5 (default 0 = off): phosphor tail on moving highlights")
    # video plumbing
    ap.add_argument("--grain", type=float, default=1.0,
                    help="grain strength multiplier 0-1 (default 1.0). The single biggest file-size "
                         "lever: per-frame noise is incompressible, so grain dominates bitrate. "
                         "0.5 = half-strength grain, roughly half the noise bits")
    ap.add_argument("--width", type=int, default=0,
                    help="max width in px before grading (0 = no limit). --width and --height form a "
                         "fit-in box: downscale only, aspect kept, nothing is ever upscaled. "
                         "miniDV's own frame is 720x480 - a small box is authentic AND much faster")
    ap.add_argument("--height", type=int, default=0,
                    help="max height in px, 0 = no limit. Portrait video's tall side is the height: "
                         "1080x1920 needs --height 480 (not --width) to actually shrink")
    ap.add_argument("--procs", type=int, default=min(8, max(1, (os.cpu_count() or 2) - 1)),
                    help="worker processes (default: cores-1, capped 8; 1 = sequential)")
    ap.add_argument("--encoder", default="libx264", choices=["libx264", "h264_videotoolbox"],
                    help="H.264 encoder (default libx264 = best quality; h264_videotoolbox = hardware, much faster)")
    ap.add_argument("--crf", type=int, default=23,
                    help="libx264 quality (default 23; lower = better/bigger, higher = smaller; "
                         "the tape look hides compression well - 26-28 is still usable)")
    ap.add_argument("--preset", default="medium", help="libx264 speed preset (default medium)")
    ap.add_argument("--vbitrate", type=int, default=12_000_000, help="bitrate for h264_videotoolbox (default 12M)")
    args = ap.parse_args()
    args.tint = args.tint if args.tint is not None else H.PALETTES.get(args.palette, {}).get("tint", H.TINT)

    files = []
    for p in args.inputs:
        if os.path.isdir(p):
            files += sorted(os.path.join(p, f) for f in os.listdir(p)
                            if f.lower().endswith(VIDEO_EXTS))
        else:
            files.append(p)
    if not files:
        sys.exit("No video files found")

    pool = None
    if args.procs > 1:
        pool = ProcessPoolExecutor(max_workers=args.procs)  # spawn (macOS default): needs the __main__ guard
    try:
        for f in files:
            stem, ext = os.path.splitext(os.path.basename(f))
            out_ext = ext.lower() if ext.lower() in (".mp4", ".mov", ".mkv") else ".mp4"
            outdir = args.outdir or os.path.dirname(f) or "."
            os.makedirs(outdir, exist_ok=True)
            convert(f, os.path.join(outdir, f"{stem}.{args.suffix}{out_ext}"), args, pool)
    finally:
        if pool:
            pool.shutdown()


if __name__ == "__main__":
    main()
