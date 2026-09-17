// lab transport: laser-card render submit + poll + artifact download.
// Reuses hotaru.ts's request() skeleton (multipart + binary shapes that apiFetch
// can't cover). Pure TS, no React; components don't fetch directly, they call these.

import { apiFetch } from "./client";
import { request } from "./hotaru";
import type { LaserCardJob, LaserCardKind, LaserCardSubmitResponse } from "./types";
import { currentT } from "../i18n/dict";

/** Submit a photo for a laser-card render → jobId (render takes minutes; upload time
 *  depends on file size, so no default timeout — the caller controls it via signal). */
export async function submitLaserCard(
  file: Blob,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await request("/v1/lab/laser-card", { method: "POST", body: fd, signal: opts.signal });
  const data = (await res.json()) as LaserCardSubmitResponse;
  return data.jobId;
}

/** Poll job status: plain JSON, so apiFetch directly (8 s is plenty). */
export function getLaserCardJob(jobId: string): Promise<LaserCardJob> {
  return apiFetch<LaserCardJob>(`/v1/lab/laser-card/${encodeURIComponent(jobId)}`);
}

/** Download one artifact (front / 3d / alpha / glb); the server answers 409 unless
 *  the job is done. */
export async function downloadLaserCardFile(
  jobId: string,
  kind: LaserCardKind,
  opts: { signal?: AbortSignal } = {},
): Promise<Blob> {
  const res = await request(
    `/v1/lab/laser-card/${encodeURIComponent(jobId)}/file/${kind}`,
    { signal: opts.signal },
  );
  return await res.blob();
}

/** Polls until a terminal state (done/failed); every status change goes through onJob
 *  (for the UI progress bar). A 404 (job expired / server restarted) rethrows its
 *  ApiError — the caller decides whether to resubmit or report. Renders take minutes,
 *  so the default interval is looser than hotaru video's. */
export async function pollLaserCard(
  jobId: string,
  opts: { intervalMs?: number; signal?: AbortSignal; onJob?: (job: LaserCardJob) => void } = {},
): Promise<LaserCardJob> {
  const intervalMs = opts.intervalMs ?? 3000;
  for (;;) {
    const job = await getLaserCardJob(jobId);
    opts.onJob?.(job);
    if (job.status === "done" || job.status === "failed") return job;
    await sleep(intervalMs, opts.signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException(currentT("api.pollCancelled"), "AbortError"));
      },
      { once: true },
    );
  });
}
