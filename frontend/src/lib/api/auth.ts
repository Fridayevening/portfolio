// 主人之锁 transport:unlock 验口令(节流在服务端),me 验存量令牌是否仍
// 有效 —— 口令轮换后前端据此自动回锁定态。request 骨架沿用 articles.ts
// 约定,me 需要带主人头(ownerHeaders),unlock 本身不带。

import { ApiError, getApiBaseUrl } from "./client";
import { owner, ownerHeaders } from "./owner";
import { currentT } from "../i18n/dict";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiError("offline", `${currentT("api.offline")}:${path}`);

  let res: Response;
  try {
    res = await fetch(base + path, {
      ...init,
      headers: { "content-type": "application/json", accept: "application/json", ...init.headers },
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

export function unlockOwner(token: string): Promise<{ ok: true }> {
  return request<{ ok: true }>("/v1/auth/unlock", { method: "POST", body: JSON.stringify({ token }) });
}

export function ownerMe(): Promise<{ owner: boolean }> {
  return request<{ owner: boolean }>("/v1/auth/me", { headers: ownerHeaders() });
}

/** Boot check: a stored token may be stale (OWNER_TOKEN rotated). Silent pass on
 *  failure — the lock UI surfaces the state; only a definitive `owner:false`
 *  while a token exists means "log out". */
export async function verifyOwner(): Promise<void> {
  if (!owner.get().token) return;
  try {
    const me = await ownerMe();
    if (!me.owner) owner.lock();
  } catch {
    // Offline server: keep the token, it may still be valid later.
  }
}
