// 界面偏好 transport:GET /v1/preferences(无则 null),PUT 全量保存。request
// 骨架沿用 articles.ts 的约定(base URL + ApiError 复用);偏好是后台同步,
// 不设默认超时,取消权在 prefsState。

import { ApiError, getApiBaseUrl } from "./client";
import { ownerHeaders } from "./owner";
import type { DesktopPrefs, PreferencesResponse, PrivacyPrefs, UiPrefs } from "./types";
import { currentT } from "../i18n/dict";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) throw new ApiError("offline", `${currentT("api.offline")}:${path}`);

  let res: Response;
  try {
    res = await fetch(base + path, {
      ...init,
      // Owner header first: PUT is owner-only server-side; a visitor's toggle
      // stays local (scheduleSave short-circuits) so the header is moot for it.
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

export function getPreferences(): Promise<PreferencesResponse | null> {
  return request<PreferencesResponse | null>("/v1/preferences");
}

/** Whole-doc save of the namespaces this client owns (currently all three). */
export function savePreferences(prefs: {
  ui: UiPrefs;
  desktop: DesktopPrefs;
  privacy: PrivacyPrefs;
}): Promise<PreferencesResponse> {
  return request<PreferencesResponse>("/v1/preferences", {
    method: "PUT",
    body: JSON.stringify(prefs),
  });
}
