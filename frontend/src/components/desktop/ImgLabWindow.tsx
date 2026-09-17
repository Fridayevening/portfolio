"use client";

// Image laboratory (IMGLAB.EXE): the container for experimental 3D image treatments
// that only the server can run. First instrument: laser-card — a photo becomes a
// frosted-glass trading card via the server-side Blender pipeline (minutes-long job:
// submit → poll → fetch). Future instruments slot in as new tabs next to Laser Card.

import { useEffect, useRef, useState } from "react";
import { useDesktop } from "./context";
import { MenuBar, StatusBar } from "./windows";
import { ApiError } from "@/lib/api/client";
import { downloadLaserCardFile, pollLaserCard, submitLaserCard } from "@/lib/api/lab";
import type { LaserCardJob, LaserCardStage } from "@/lib/api/types";
import { useConnection } from "@/lib/api/mode";
import LaserCard3D from "./LaserCard3D";
import { useI18n } from "@/lib/i18n/LanguageContext";
import type { DictKey } from "@/lib/i18n/dict";

const MAX_BYTES = 25 * 1024 * 1024; // the server's multer limit; the front end blocks early

// This window's id in the desktop table, for the self-resize below.
const LAB_WIN_ID = "imglab";
// Bench measurements for the window fit: p-[12px] on both axes, plus the flex gap
// between the photo mount and the caption. The chrome stacked around the flex-1 bench
// (menubar/tab row/action row/statusbar) is measured live off the DOM instead of being
// restated here — those rings never move with the window size.
const BENCH_PAD = 24;
const BENCH_GAP = 8;
const LAB_MIN = { w: 560, h: 540 }; // the window def's default; small photos keep it
// Size ceiling: the lab is a workbench, not a 1:1 inspector — without this, nearly
// every photo scales up to fill the viewport's height budget (fitViewerBox caps its
// viewer windows the same way, at 1000x760).
const LAB_MAX = { w: 720, h: 620 };

const STAGE_LABEL: Record<LaserCardStage, DictKey> = {
  textures: "imglab.stage.textures",
  front: "imglab.stage.front",
  "3d": "imglab.stage.3d",
  alpha: "imglab.stage.alpha",
  glb: "imglab.stage.glb",
};

type Phase = "idle" | "ready" | "rendering" | "done";

/** ApiError → dialog lines; cancellation is checked by the caller before this runs. */
function labErrorLines(err: unknown, t: (key: DictKey) => string): string[] {
  if (err instanceof ApiError) {
    if (err.kind === "offline")
      return [t("hotaru.error.offline1"), t("imglab.offline2"), t("imglab.offline3")];
    if (err.kind === "timeout") return [t("imglab.timeout"), t("hotaru.error.retry")];
    if (err.kind === "network") return [t("hotaru.error.network"), t("hotaru.error.check")];
    if (err.status === 404) return [t("imglab.expired"), t("imglab.ttl"), t("imglab.resubmit")];
    if (err.status === 429) return [t("imglab.queueFull"), t("imglab.wait")];
    if (err.status === 413) return [t("hotaru.error.large"), t("hotaru.error.limit")];
    if (err.status === 400) return [t("hotaru.error.rejected"), t("hotaru.error.params")];
    return [t("hotaru.error.server"), t("imglab.workshop").replace("{status}", String(err.status))];
  }
  return [t("hotaru.error.unknown"), String(err)];
}

export default function ImgLabWindow() {
  const api = useDesktop();
  const { t } = useI18n();
  const conn = useConnection();
  const [phase, setPhase] = useState<Phase>("idle");
  const [src, setSrc] = useState<{ file: File; url: string } | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [job, setJob] = useState<LaserCardJob | null>(null);
  // Deliverables: the front render framed, the GLB feeding the interactive 3D view.
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [glb, setGlb] = useState<Blob | null>(null);
  const [mode3d, setMode3d] = useState(false);
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fetching, setFetching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const benchRef = useRef<HTMLDivElement | null>(null);
  const captionRef = useRef<HTMLDivElement | null>(null);

  const offline = conn.status === "local";
  const busy = phase === "rendering";

  // objectURL revocation follows the value: swap source / swap results / close window.
  useEffect(() => () => { if (src) URL.revokeObjectURL(src.url); }, [src]);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); }, [frontUrl]);
  // Closing the window aborts in-flight requests — the server-side render keeps going
  // (its result survives the 30-minute TTL), we just stop watching.
  useEffect(() => () => abortRef.current?.abort(), []);

  function clearViews() {
    if (frontUrl) URL.revokeObjectURL(frontUrl);
    setFrontUrl(null);
    setGlb(null);
  }

  function loadFile(file: File | undefined | null) {
    if (!file) return;
    // Front-end checks before the network: 413 and bad extensions are caught locally.
    if (!/\.(png|jpe?g|webp|bmp)$/i.test(file.name)) {
      api.dialog(t("imglab.title"), [t("hotaru.badType"), t("hotaru.allowedTypes")]);
      return;
    }
    if (file.size > MAX_BYTES) {
      api.dialog(t("imglab.title"), [t("hotaru.error.large"), t("hotaru.error.limit")]);
      return;
    }
    clearViews();
    setJob(null);
    setNat(null);
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { file, url: URL.createObjectURL(file) };
    });
    setPhase("ready");
    setNote("");
    setMode3d(false);
  }

  // Resizes the window to the loaded photo — near 1:1, scaled down to the LAB_MAX ∩
  // viewport budget, never up. The chrome delta (window frame − bench) is measured
  // live: every ring around the flex-1 bench is static, so the delta holds at any
  // window size and there are no per-ring constants to drift out of sync (the imgtool
  // viewer windows hardcode theirs; this window's stack is deeper, so it measures).
  function fitToPhoto(n: { w: number; h: number }) {
    const bench = benchRef.current;
    const frame = bench?.closest(".win95");
    if (!bench || !(frame instanceof HTMLElement)) return;
    const dX = frame.getBoundingClientRect().width - bench.clientWidth;
    const dY = frame.getBoundingClientRect().height - bench.clientHeight;
    const caption = captionRef.current?.offsetHeight ?? 0;
    // The viewport floor mirrors api.fit's clamps (24px margins, 36px taskbar).
    const availW = Math.min(LAB_MAX.w, window.innerWidth - 24) - dX - BENCH_PAD;
    const availH = Math.min(LAB_MAX.h, window.innerHeight - 36 - 24) - dY - BENCH_PAD - BENCH_GAP - caption;
    const s = Math.min(1, availW / n.w, availH / n.h);
    api.fit(
      LAB_WIN_ID,
      Math.max(LAB_MIN.w, n.w * s + BENCH_PAD + dX),
      Math.max(LAB_MIN.h, n.h * s + BENCH_PAD + BENCH_GAP + caption + dY),
    );
  }

  async function render() {
    if (!src || busy) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("rendering");
    setFetching(false);
    setNote("");
    try {
      const jobId = await submitLaserCard(src.file, { signal: ctrl.signal });
      const done = await pollLaserCard(jobId, { signal: ctrl.signal, onJob: setJob });
      if (done.status === "failed") {
        api.dialog(t("imglab.renderFailed"), [t("imglab.pipelineFailed"), done.error ?? t("imglab.noDetails")]);
        setPhase("ready");
        setNote(t("imglab.lastFailed"));
        return;
      }
      // Fetch both deliverables up front: framing the result must not race the
      // 30-minute TTL sweeper.
      setFetching(true);
      const [front, glbFile] = await Promise.all([
        downloadLaserCardFile(jobId, "front", { signal: ctrl.signal }),
        downloadLaserCardFile(jobId, "glb", { signal: ctrl.signal }),
      ]);
      clearViews();
      setFrontUrl(URL.createObjectURL(front));
      setGlb(glbFile);
      setMode3d(false); // every fresh result opens on the front render
      setPhase("done");
    } catch (err) {
      // Cancellation is wrapped as kind:"network" by the transport — check the signal
      // before assigning blame.
      if (ctrl.signal.aborted) {
        setPhase("ready");
        setNote(t("imglab.cancelled"));
      } else {
        api.dialog(t("imglab.renderFailed"), labErrorLines(err, t));
        setPhase("ready");
        setNote(t("imglab.lastFailed"));
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  function saveFront() {
    if (!frontUrl || !src) return;
    const a = document.createElement("a");
    a.href = frontUrl;
    a.download = `${src.file.name.replace(/\.[^.]+$/, "")}.laser-card.png`;
    a.click();
  }

  const stageText = job
    ? job.status === "queued"
      ? t("imglab.queued").replace("{count}", String(job.queuePosition ?? 0))
      : job.stage
        ? `${t(STAGE_LABEL[job.stage])}…`
        : t("imglab.rendering")
    : t("imglab.rendering");
  const statusText =
    phase === "idle" ? t("hotaru.status.idle") : phase === "ready" ? t("hotaru.status.ready") : phase === "rendering" ? (fetching ? t("imglab.fetching") : stageText) : t("hotaru.status.done");
  const statusLeft = [src?.file.name, statusText, note || null].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MenuBar items={[t("imglab.menu.file"), t("imglab.menu.view"), t("imglab.menu.help")]} right="IMGLAB v0.1" />
      {/* Instrument tabs: one instrument today; the row itself is the extension point
          for the next ones. */}
      <div className="flex items-end gap-[2px] px-[6px] pt-[4px] bg-chrome">
        <span className="bevel-thin-out bg-chrome px-[10px] py-[2px] text-[11px] font-bold">{t("imglab.laserCard")}</span>
        <span className="pl-[6px] text-[10px] text-black/40">{t("imglab.future")}</span>
      </div>

      <div
        ref={benchRef}
        className={`flex-1 min-h-0 bg-[#55524a] bevel-in m-[3px] mt-0 flex flex-col gap-[8px] p-[12px] overflow-hidden ${
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
        {offline ? (
          <div className="flex-1 bevel-thin-in bg-black/20 flex flex-col items-center justify-center gap-[10px]">
            <span className="font-display text-[20px] text-[#ddd8c8]/70">{t("imglab.closed")}</span>
            <span className="text-[11px] text-[#ddd8c8]/60 text-center leading-[1.7]">
              {t("imglab.offlineSentence")}
              <br />
              {t("imglab.siteWorks")}
            </span>
          </div>
        ) : busy ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-[14px]">
            {src && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={src.url}
                alt={src.file.name}
                draggable={false}
                className="max-h-[42%] max-w-[70%] object-contain opacity-80"
                style={{ filter: "saturate(0.7) brightness(0.9)" }}
              />
            )}
            <span className="font-display text-[18px] text-[#ddd8c8]">
              {fetching ? t("imglab.fetchingShort") : stageText}
              <span className="cursor-blink">_</span>
            </span>
            {/* Win95 progress track: Blender prints no per-sample output in background
                mode, so the bar steps at stage boundaries (0/10/40/70/90/100). */}
            <div className="w-[70%] h-[16px] bevel-thin-in bg-black/25 p-[2px]">
              <div className="h-full bg-navy transition-[width] duration-500" style={{ width: `${job?.progress ?? 0}%` }} />
            </div>
            <span className="text-[11px] text-[#ddd8c8]/60">{t("imglab.estimate")}</span>
            <button
              type="button"
              className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press"
              onClick={cancel}
            >
              {t("imglab.stopWaiting")}
            </button>
          </div>
        ) : phase === "done" && frontUrl ? (
          mode3d && glb && src ? (
            /* Interactive inspection of the delivered model (proto demo port). */
            <LaserCard3D glb={glb} downloadName={`${src.file.name.replace(/\.[^.]+$/, "")}.laser-card.glb`} />
          ) : (
            /* done: the front render is the deliverable. */
            <div className="flex-1 min-h-0 bg-black/20 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frontUrl} alt={t("imglab.cardAlt")} draggable={false} className="max-h-full max-w-full object-contain" />
            </div>
          )
        ) : src ? (
          /* ready: the loaded photo waits on the bench — the drop handlers above stay
             live, so dragging a new one over replaces it without a detour. */
          <>
            <div className="flex-1 min-h-0 bg-black/20 overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src.url}
                alt={src.file.name}
                draggable={false}
                onLoad={(e) => {
                  const n = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
                  setNat(n);
                  fitToPhoto(n);
                }}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <div ref={captionRef} className="shrink-0 flex flex-col items-center gap-[2px]">
              <span className="text-[11px] text-[#ddd8c8]">
                {src.file.name}
                {nat ? ` · ${nat.w}x${nat.h}px` : ""}
              </span>
              <span className="text-[10px] text-[#ddd8c8]/50">{t("imglab.replaceHint")}</span>
            </div>
          </>
        ) : (
          /* idle: the whole bench is the dropzone — drop or click to pick */
          <button
            type="button"
            className="flex-1 bevel-thin-in bg-black/20 flex flex-col items-center justify-center gap-[10px] outline-none"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="font-display text-[24px] text-[#ddd8c8]">{t("imglab.drop")}</span>
            <span className="text-[11px] text-[#ddd8c8]/60 text-center leading-[1.7]">
              {t("imglab.dropHint")}
              <br />
              {t("imglab.outputHint")}
            </span>
          </button>
        )}
      </div>

      {/* Action row. */}
      <div className="shrink-0 flex items-center justify-center gap-[10px] py-[4px]">
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press disabled:opacity-50 disabled:pointer-events-none"
          disabled={busy || offline}
          onClick={() => fileInputRef.current?.click()}
        >
          {t("imglab.load")}
        </button>
        {!busy && (
          <button
            type="button"
            className="bevel-thin-out bg-chrome px-6 py-[3px] text-[12px] font-bold press disabled:opacity-50 disabled:pointer-events-none"
            disabled={!src || offline}
            onClick={() => void render()}
          >
            {t("imglab.start")}
          </button>
        )}
        {phase === "done" && (
          <>
            <button
              type="button"
              className="bevel-thin-out bg-chrome px-4 py-[3px] text-[12px] press"
              onClick={saveFront}
            >
              {t("imglab.saveFront")}
            </button>
            <button
              type="button"
              className={`bevel-thin-out px-4 py-[3px] text-[12px] press disabled:opacity-50 disabled:pointer-events-none ${
                mode3d ? "bg-navy text-white" : "bg-chrome"
              }`}
              disabled={!glb}
              onClick={() => setMode3d((v) => !v)}
            >
              {mode3d ? t("imglab.front") : t("imglab.show3d")}
            </button>
          </>
        )}
      </div>

      <StatusBar left={statusLeft} right={t("imglab.title")} />

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
