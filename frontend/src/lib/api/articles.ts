// 文稿 articles transport: JSON CRUD against /v1/articles. apiFetch is GET-only,
// so the method/body skeleton here mirrors hotaru.ts (base URL + ApiError reused,
// no second copy). No timeout by default — same rationale as hotaru: the caller
// owns cancellation, and a save must not be cut mid-flight. Components don't
// fetch directly; Paper.tsx calls these.

import { ApiError, getApiBaseUrl } from "./client";
import { ownerHeaders } from "./owner";
import type { Article, ArticleSummary } from "./types";
import { currentT } from "../i18n/dict";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiError("offline", `${currentT("api.offline")}:${path}`);

  let res: Response;
  try {
    res = await fetch(base + path, {
      ...init,
      // Owner header first: visitors (and visitor preview) simply don't send it.
      headers: { "content-type": "application/json", accept: "application/json", ...ownerHeaders(), ...init.headers },
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("network", currentT("api.network").replace("{path}", path), { cause: err });
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

/** Bookshelf list, most recently saved first. */
export function listArticles(): Promise<ArticleSummary[]> {
  return request<ArticleSummary[]>("/v1/articles");
}

export function getArticle(id: string): Promise<Article> {
  return request<Article>(`/v1/articles/${encodeURIComponent(id)}`);
}

export function createArticle(name: string, secret = false): Promise<Article> {
  return request<Article>("/v1/articles", { method: "POST", body: JSON.stringify({ name, secret }) });
}

/** Privacy toggle (doc 08 §1.1) — a dedicated action endpoint, deliberately not
 *  part of PUT: autosave must never touch the flag. */
export function setArticleSecret(id: string, secret: boolean): Promise<Article> {
  return request<Article>(`/v1/articles/${encodeURIComponent(id)}/secret`, {
    method: "POST",
    body: JSON.stringify({ secret }),
  });
}

/** Full-body save; idempotent by design — the editor auto-saves on a 2 s debounce
 *  and Ctrl+S flushes immediately, both through here. `name` omitted = keep. */
export function saveArticle(id: string, body: string, name?: string): Promise<Article> {
  const payload = name === undefined ? { body } : { body, name };
  return request<Article>(`/v1/articles/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function removeArticle(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/v1/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
}
