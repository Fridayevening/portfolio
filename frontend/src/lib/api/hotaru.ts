// hotaru transport: multipart upload + binary download.
// apiFetch is JSON-only with an 8 s default timeout and can't cover these shapes; base
// URL resolution and ApiError normalization are reused from client.ts — no second copy
// in this file (it would drift). Pure TS, no React; components don't fetch directly,
// they call these.

import { apiFetch, ApiError, getApiBaseUrl } from "./client";
import type {
  HotaruImageOptions,
  HotaruJob,
  HotaruSubmitResponse,
  HotaruVideoOptions,
} from "./types";
import { currentT } from "../i18n/dict";

function toForm(file: Blob, options?: object): FormData {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("options", JSON.stringify(options ?? {}));
  return fd;
}

/** Shared request skeleton: error normalization matches client.ts's apiFetch; an
 *  omitted timeoutMs means no timeout (large uploads/downloads must not be cut off —
 *  the caller controls them via signal). Exported for lab.ts — the transport rules
 *  live once, here. */
export async function request(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiError("offline", `${currentT("api.offline")}:${path}`);

  const ctrl = new AbortController();
  const timer =
    timeoutMs !== undefined
      ? setTimeout(() => ctrl.abort(new ApiError("timeout", currentT("api.timeout").replace("{path}", path))), timeoutMs)
      : null;
  const signal =
    init.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([ctrl.signal, init.signal])
      : (init.signal ?? ctrl.signal);

  let res: Response;
  try {
    res = await fetch(base + path, { ...init, signal });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("network", currentT("api.network").replace("{path}", path), { cause: err });
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      // A non-JSON error body still surfaces as an http error.
    }
    throw new ApiError("http", `HTTP ${res.status}:${path}`, { status: res.status, payload });
  }
  return res;
}

/** Image: upload → synchronously receive the processed Blob (the server fails first at
 *  30 s; the 60 s here only catches network long-tails). */
export async function processHotaruImage(
  file: Blob,
  options: HotaruImageOptions = {},
  opts: { signal?: AbortSignal } = {},
): Promise<Blob> {
  const res = await request(
    "/v1/hotaru/image",
    { method: "POST", body: toForm(file, options), signal: opts.signal },
    60_000,
  );
  return await res.blob();
}

/** Video: submit → jobId (upload time depends on file size; no default timeout — the
 *  caller controls it via signal). */
export async function submitHotaruVideo(
  file: Blob,
  options: HotaruVideoOptions = {},
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const res = await request("/v1/hotaru/video", {
    method: "POST",
    body: toForm(file, options),
    signal: opts.signal,
  });
  const data = (await res.json()) as HotaruSubmitResponse;
  return data.jobId;
}

/** Poll job status: plain JSON, so apiFetch directly (8 s is plenty). */
export function getHotaruVideoJob(jobId: string): Promise<HotaruJob> {
  return apiFetch<HotaruJob>(`/v1/hotaru/video/${encodeURIComponent(jobId)}`);
}

/** Download the finished video; the server answers 409 unless the job is done. */
export async function downloadHotaruVideo(jobId: string): Promise<Blob> {
  const res = await request(`/v1/hotaru/video/${encodeURIComponent(jobId)}/download`);
  return await res.blob();
}

/** Polls until a terminal state (done/failed); every status change goes through onJob
 *  (for the UI progress bar). A 404 (job expired / server restarted) rethrows its
 *  ApiError — the caller decides whether to resubmit or report. */
export async function pollHotaruVideo(
  jobId: string,
  opts: { intervalMs?: number; signal?: AbortSignal; onJob?: (job: HotaruJob) => void } = {},
): Promise<HotaruJob> {
  const intervalMs = opts.intervalMs ?? 2000;
  for (;;) {
    const job = await getHotaruVideoJob(jobId);
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
        reject(signal.reason ?? new ApiError("network", currentT("api.pollCancelled")));
      },
      { once: true },
    );
  });
}
