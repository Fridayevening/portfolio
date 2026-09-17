// 桌面文件系统 transport:JSON CRUD against /v1/files。与 articles.ts 同构的
// method/body 骨架(base URL + ApiError 复用,每模块一份的既定先例)。默认
// 不设超时 —— 同 articles:调用方拥有取消权,创建不能被截断。组件不直接
// fetch,Desktop/Fs 调这些。

import { ApiError, getApiBaseUrl } from "./client";
import { ownerHeaders } from "./owner";
import type { FsNode, FsType, TrashNode } from "./types";
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

/** Children of a folder; parent omitted = the desktop surface (top level). */
export function listFsNodes(parent?: string): Promise<FsNode[]> {
  const q = parent ? `?parent=${encodeURIComponent(parent)}` : "";
  return request<FsNode[]>(`/v1/files${q}`);
}

export function getFsNode(id: string): Promise<FsNode> {
  return request<FsNode>(`/v1/files/${encodeURIComponent(id)}`);
}

/** The server owns naming (dedup included); the payload is just type + location. */
export function createFsNode(req: { type: FsType; parent?: string; secret?: boolean }): Promise<FsNode> {
  return request<FsNode>("/v1/files", { method: "POST", body: JSON.stringify(req) });
}

/** Privacy toggle (doc 08 §1.1) — server-side read filtering follows the flag;
 *  caller bumps the fs revision so every surface refetches. */
export function setFsNodeSecret(id: string, secret: boolean): Promise<FsNode> {
  return request<FsNode>(`/v1/files/${encodeURIComponent(id)}/secret`, {
    method: "POST",
    body: JSON.stringify({ secret }),
  });
}

/** Rename. Name clashes surface as HTTP 400 (已有同名项目) — the caller shows a
 *  dialog; sibling dedup is reserved for machine-driven paths. */
export function renameFsNode(id: string, name: string): Promise<FsNode> {
  return request<FsNode>(`/v1/files/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ name }) });
}

/** Soft-delete a subtree; the ids come back so the caller can close windows. */
export function trashFsNode(id: string): Promise<{ trashed: string[] }> {
  return request<{ trashed: string[] }>(`/v1/files/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listTrash(): Promise<TrashNode[]> {
  return request<TrashNode[]>("/v1/files/trash");
}

export function restoreFsNode(id: string): Promise<FsNode> {
  return request<FsNode>(`/v1/files/${encodeURIComponent(id)}/restore`, { method: "POST", body: "{}" });
}

/** Permanently delete one trashed subtree (articles and image bytes included). */
export function purgeFsNode(id: string): Promise<{ purged: number }> {
  return request<{ purged: number }>(`/v1/files/${encodeURIComponent(id)}/purge`, { method: "POST", body: "{}" });
}

export function emptyTrash(): Promise<{ purged: number }> {
  return request<{ purged: number }>("/v1/files/trash", { method: "DELETE" });
}

/** Paste-copy: deep clone into a folder. `undefined` = server default (the
 *  source's own parent); `null` = the desktop surface — sent explicitly, else
 *  the server would fall back to the default. */
export function copyFsNode(id: string, parent?: string | null): Promise<FsNode> {
  return request<FsNode>(`/v1/files/${encodeURIComponent(id)}/copy`, {
    method: "POST",
    body: JSON.stringify(parent === undefined ? {} : { parent }),
  });
}

/** Paste-cut: move to a folder. `undefined` = server default; `null` = desktop. */
export function moveFsNode(id: string, parent?: string | null): Promise<FsNode> {
  return request<FsNode>(`/v1/files/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify(parent === undefined ? {} : { parent }),
  });
}

/** Viewer URL for an image node's bytes. Null in offline mode — callers must
 *  not render an <img> with it in that case. */
export function fsImageUrl(id: string): string | null {
  const base = getApiBaseUrl();
  return base ? `${base}/v1/files/${encodeURIComponent(id)}/image` : null;
}
