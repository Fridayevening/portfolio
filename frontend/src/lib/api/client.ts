// REST client: base URL resolution, timeout, JSON, error normalization.
// Components must not use this directly — by convention only the mode probe and the
// future LiveSource fetches call it.
import { currentT } from "../i18n/dict";

export type ApiErrorKind = "offline" | "timeout" | "network" | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly payload?: unknown;

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { status?: number; payload?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = opts.status;
    this.payload = opts.payload;
  }
}

/**
 * API base URL: the environment variable wins; unset in dev falls back to localhost:3031
 * so a fresh clone just runs; unset in a production build → null (offline mode, the
 * local engine takes over and the site stays fully functional).
 */
export function getApiBaseUrl(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return process.env.NODE_ENV === "development" ? "http://localhost:3031" : null;
}

export async function apiFetch<T>(
  path: string,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiError("offline", currentT("api.offline"));

  const timeoutMs = opts.timeoutMs ?? 8000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new ApiError("timeout", currentT("api.timeout").replace("{path}", path))), timeoutMs);
  // Either the external signal or the timeout signal, whichever fires.
  const signal =
    opts.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([ctrl.signal, opts.signal])
      : ctrl.signal;

  let res: Response;
  try {
    // Tell the server which language the UI is in, so API error messages match.
    const lang = typeof document !== "undefined" && /(?:^|;\s*)nb-lang=en(?:;|$)/.test(document.cookie) ? "en" : "zh";
    res = await fetch(base + path, { signal, headers: { accept: "application/json", "x-lang": lang } });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("network", currentT("api.network").replace("{path}", path), { cause: err });
  } finally {
    clearTimeout(timer);
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
  return (await res.json()) as T;
}
