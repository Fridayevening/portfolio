"use client";

// 界面偏好的外部存储,fsState/stickyState 同款:模块级状态 + useSyncExternalStore,
// 谁都不为谁重渲染。持久化双轨 —— localStorage 是启动缓存(挂载即恢复,离线也能
// 用),服务器是长久之家(2s 防抖 PUT,与文稿自动保存同一节奏)。
//
// 文档按命名空间分组:ui(CRT 特效/弧面玻璃/桌面色)、desktop(图标布局),服务
// 端 PUT 按命名空间条件更新。fs-* 图标键在文件删除后成为残键 —— 查表只按现存
// id,残键无害,不清理。
//
// 启动对账(last-writer-wins):savedAt 记"最后一次确认与服务器一致的服务器
// 时间"(GET 命中或 PUT 回执)。GET 回来更新则远端覆盖本地;本地更新或服务器还
// 没有 → 防抖推上去。防抖窗口内关页面不丢数据 —— 下次启动对账发现本地更新,
// 照样推,自愈。

import { useSyncExternalStore } from "react";
import { getApiBaseUrl } from "../../lib/api/client";
import { getPreferences, savePreferences } from "../../lib/api/preferences";
import { isVisitorView } from "../../lib/api/owner";
import type { DesktopPrefs, PreferencesResponse, PrivacyPrefs, UiPrefs } from "../../lib/api/types";
import {
  EMPTY_ICON_POS,
  PREFS_COOKIE,
  PRIVACY_DEFAULTS,
  UI_DEFAULTS,
  prefsCookieValue,
  sanitizeIconPos,
  sanitizePrivacy,
  sanitizeUi,
  type BootPrefs,
  type IconPos,
} from "../../lib/prefs";

const LS_KEY = "nb-ui-prefs";
const SAVE_DEBOUNCE_MS = 2000;

// Restore-time clamp mirrors Desktop.moveIcon's drag clamp (86 = icon footprint
// width, 70 = footprint height ×1.2, 36 = taskbar): a layout saved on a bigger
// viewport must not strand icons off-screen on a smaller one.
const ICON_W = 86;
const ICON_H = 70;
const TASKBAR_H = 36;

export { UI_DEFAULTS };

export type Prefs = { ui: UiPrefs; desktop: DesktopPrefs; privacy: PrivacyPrefs };

const DEFAULTS: Prefs = { ui: UI_DEFAULTS, desktop: { iconPos: {} }, privacy: PRIVACY_DEFAULTS };

let state: Prefs = DEFAULTS;
/** Server time of the last moment the server copy was known current; 0 = never. */
let savedAt = 0;
/** Set on any local change, cleared by a successful PUT of that state. While
 *  true the boot reconcile must not let an older remote clobber the local copy. */
let dirty = false;
let restored = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

// Client-only viewport clamp on top of the shared bounds sanitize.
function clampIconPosToViewport(p: IconPos): IconPos {
  const out: IconPos = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = {
      x: Math.min(Math.max(v.x, 0), Math.max(0, window.innerWidth - ICON_W)),
      y: Math.min(Math.max(v.y, 0), Math.max(0, window.innerHeight - TASKBAR_H - ICON_H)),
    };
  }
  return out;
}

/** Accepts both the current { ui, desktop, privacy } payload and the flat
 *  ui-only shape the first build wrote (its prefs start with crt/glass, not
 *  namespaces); older caches without privacy fall back to its defaults. */
function sanitizePrefs(v: unknown): Prefs {
  if (typeof v !== "object" || v === null) return DEFAULTS;
  const o = v as { ui?: unknown; desktop?: unknown; privacy?: unknown };
  return {
    ui: sanitizeUi("ui" in o ? o.ui : o),
    desktop: { iconPos: sanitizeIconPos(o.desktop && typeof o.desktop === "object" ? (o.desktop as { iconPos?: unknown }).iconPos : null) },
    privacy: sanitizePrivacy(o.privacy),
  };
}

const sameUi = (a: UiPrefs, b: UiPrefs): boolean =>
  a.crt === b.crt && a.glass === b.glass && a.desktopColor === b.desktopColor;

const sameIconPos = (a: IconPos, b: IconPos): boolean => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k]?.x === b[k]?.x && a[k]?.y === b[k]?.y);
};

const samePrivacy = (a: PrivacyPrefs, b: PrivacyPrefs): boolean =>
  a.defaultSecret === b.defaultSecret &&
  a.hiddenApps.length === b.hiddenApps.length &&
  a.hiddenApps.every((id, i) => id === b.hiddenApps[i]);

const samePrefs = (a: Prefs, b: Prefs): boolean =>
  sameUi(a.ui, b.ui) && sameIconPos(a.desktop.iconPos, b.desktop.iconPos) && samePrivacy(a.privacy, b.privacy);

function persistLocal(): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify({ prefs: state, savedAt }));
    // Mirror ui + the compact iconPos/hiddenApps projection into the cookie so
    // the next SSR paints all three on frame one (see lib/prefs.ts).
    document.cookie = `${PREFS_COOKIE}=${encodeURIComponent(
      prefsCookieValue(state.ui, state.desktop.iconPos, state.privacy.hiddenApps),
    )}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Quota/private-mode failures only lose the cache, never the session.
  }
}

async function flushSave(): Promise<void> {
  saveTimer = null;
  const snapshot = state;
  try {
    const res = await savePreferences({ ui: snapshot.ui, desktop: snapshot.desktop, privacy: snapshot.privacy });
    // Stamp only what's still current: a change that landed mid-flight keeps
    // its own dirty flag and its own pending debounce.
    if (samePrefs(snapshot, state)) {
      savedAt = Date.parse(res.updatedAt) || Date.now();
      dirty = false;
      persistLocal();
    }
  } catch {
    // Server absent: stays dirty; the next change reschedules, the next boot
    // reconcile retries.
  }
}

function scheduleSave(): void {
  if (!getApiBaseUrl()) return; // offline build: localStorage is the whole story
  // Visitor view: PUT is owner-only server-side — a visitor's tweak stays in
  // this browser only (deliberate: their look, not the site's).
  if (isVisitorView()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), SAVE_DEBOUNCE_MS);
}

const commit = (next: Prefs): void => {
  if (samePrefs(next, state)) return;
  state = next;
  dirty = true;
  persistLocal();
  emit();
  scheduleSave();
};

async function reconcile(): Promise<void> {
  let remote: PreferencesResponse | null;
  try {
    remote = await getPreferences();
  } catch {
    return; // server absent: local stands, next boot retries
  }
  if (!remote) {
    // Server has never seen preferences (fresh DB): make it durable.
    if (!samePrefs(state, DEFAULTS)) scheduleSave();
    return;
  }
  const remoteAt = Date.parse(remote.updatedAt);
  if (Number.isNaN(remoteAt)) return;
  const remotePrefs: Prefs = {
    ui: sanitizeUi(remote.ui),
    desktop: { iconPos: clampIconPosToViewport(sanitizeIconPos(remote.desktop?.iconPos)) },
    privacy: sanitizePrivacy(remote.privacy),
  };
  if (!dirty && remoteAt > savedAt) {
    // The server copy is newer than anything this device confirmed: it wins.
    const changed = !samePrefs(remotePrefs, state);
    state = remotePrefs;
    savedAt = remoteAt;
    persistLocal();
    if (changed) emit();
    return;
  }
  if (samePrefs(remotePrefs, state)) {
    savedAt = remoteAt;
    persistLocal();
  } else {
    scheduleSave(); // local ahead (or a change raced the GET): push it up
  }
}

/** Whether restoreUiPrefs has run (from a mount effect — client-only, so it
 *  stays false through SSR and every server request). While false, Desktop
 *  renders the SSR-provided initial ui instead of the store; the flag and the
 *  store swap atomically pre-emit, so no render ever sees them disagree. */
export function prefsRestored(): boolean {
  return restored;
}

/** One-shot restore from a mount effect (StrictMode-safe via the flag). The
 *  localStorage half applies synchronously before the first emit; the server
 *  half reconciles whenever it answers. `boot` is the SSR cookie value — with
 *  no local cache it is adopted into the store so the render source never
 *  flips away from what frame one painted. */
export function restoreUiPrefs(boot: BootPrefs = { ui: UI_DEFAULTS, iconPos: EMPTY_ICON_POS, hiddenApps: [] }): void {
  if (restored || typeof window === "undefined") return;
  restored = true;
  let haveLocal = false;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { prefs?: unknown; savedAt?: unknown };
      const p = sanitizePrefs(parsed.prefs);
      state = { ...p, desktop: { iconPos: clampIconPosToViewport(p.desktop.iconPos) } };
      savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
      haveLocal = true;
      // Refresh the cookie too — it may predate the iconPos "p"/"h" fields.
      persistLocal();
      emit();
    }
  } catch {
    // Corrupted payload: defaults stand.
  }
  if (!haveLocal) {
    // The boot cookie carries no defaultSecret — false stands in until the
    // server reconcile lands the real privacy namespace a beat later.
    const adopted: Prefs = {
      ui: boot.ui,
      desktop: { iconPos: clampIconPosToViewport(boot.iconPos) },
      privacy: { hiddenApps: boot.hiddenApps, defaultSecret: false },
    };
    if (!samePrefs(adopted, state)) {
      state = adopted;
      emit();
    }
  }
  if (!getApiBaseUrl()) return;
  void reconcile();
}

export function setUiPrefs(patch: Partial<UiPrefs>): void {
  commit({ ...state, ui: { ...state.ui, ...patch } });
}

/** Toggle one app in the visitor-hidden list (doc 08 §1.2 curation layer). */
export function setHiddenApp(id: string, hidden: boolean): void {
  const cur = state.privacy.hiddenApps;
  const next = hidden ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((a) => a !== id);
  commit({ ...state, privacy: { ...state.privacy, hiddenApps: next } });
}

/** Non-hook read for module-level flows (e.g. createFsChild's default-secret
 *  pass-through) — post-restore it always reflects the live store. */
export function peekPrivacy(): PrivacyPrefs {
  return state.privacy;
}

export function setDefaultSecret(defaultSecret: boolean): void {
  commit({ ...state, privacy: { ...state.privacy, defaultSecret } });
}

/** Move one icon to a (already viewport-clamped, see Desktop.moveIcon) slot. */
export function setIconPosEntry(id: string, pos: { x: number; y: number }): void {
  commit({ ...state, desktop: { iconPos: { ...state.desktop.iconPos, [id]: pos } } });
}

export function useUiPrefs(): UiPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state.ui,
    () => UI_DEFAULTS,
  );
}

export function useIconPos(): DesktopPrefs["iconPos"] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state.desktop.iconPos,
    () => EMPTY_ICON_POS,
  );
}

export function usePrivacyPrefs(): PrivacyPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state.privacy,
    () => PRIVACY_DEFAULTS,
  );
}
