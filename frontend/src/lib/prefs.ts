// Shared preferences boot contract: the cookie both the server (SSR — frame one
// paints the user's look and layout) and prefsState (the client writes the
// mirror) agree on. Deliberately free of client- or server-only APIs; the
// viewport clamp happens client-side at restore, not here (the server has no
// viewport).

import type { DesktopPrefs, PrivacyPrefs, UiPrefs } from "./api/types";

/** Cookie mirroring the ui namespace + a compact iconPos projection (+ the
 *  hiddenApps hint, doc 08: the desk is SSR-painted, so without it a visitor's
 *  first frame would flash icons that vanish right after hydration); written by
 *  prefsState on every commit. */
export const PREFS_COOKIE = "nb-ui";

// Browsers cap one cookie at 4KB and silently drop the whole write beyond it.
// The budget must count the percent-encoded form — JSON's braces/quotes/commas
// all expand to 3 bytes each, so the decoded string alone is a false ceiling.
const COOKIE_BUDGET = 3600;

const fitsCookie = (s: string): boolean => encodeURIComponent(s).length <= COOKIE_BUDGET;

const HEX_RE = /^#[0-9a-f]{6}$/i;
const ICON_KEY_RE = /^[\w-]{1,64}$/;
// icon id 白名单 + 上限,与 server preferences dto 同一口径。
const MAX_ICONS = 200;
// 4K 级上限:坐标是相对视口左上角的像素,负值/百万级都是没写过的形状。
const MAX_COORD = 100_000;
// app id 白名单 + 上限,同样与 server privacy dto 同口径。
const MAX_HIDDEN_APPS = 32;

export type IconPos = DesktopPrefs["iconPos"];
export type BootPrefs = { ui: UiPrefs; iconPos: IconPos; hiddenApps: string[] };

export const UI_DEFAULTS: UiPrefs = {
  crt: true,
  glass: false,
  desktopColor: "#008080",
};
export const EMPTY_ICON_POS: IconPos = {};

export const PRIVACY_DEFAULTS: PrivacyPrefs = { hiddenApps: [], defaultSecret: false };

/** Privacy namespace sanitize, same field-by-field philosophy as sanitizeUi:
 *  bad entries drop, never fail the boot. */
export function sanitizePrivacy(v: unknown): PrivacyPrefs {
  const o = typeof v === "object" && v !== null ? (v as Partial<PrivacyPrefs>) : {};
  const apps = Array.isArray(o.hiddenApps) ? o.hiddenApps : [];
  const out: string[] = [];
  for (const id of apps.slice(0, MAX_HIDDEN_APPS)) {
    if (typeof id === "string" && ICON_KEY_RE.test(id) && !out.includes(id)) out.push(id);
  }
  return { hiddenApps: out, defaultSecret: o.defaultSecret === true };
}

/** Field-by-field fallback: a foreign/corrupt value degrades to defaults instead
 *  of failing the whole boot. */
export function sanitizeUi(v: unknown): UiPrefs {
  const o = typeof v === "object" && v !== null ? (v as Partial<UiPrefs>) : {};
  return {
    crt: typeof o.crt === "boolean" ? o.crt : UI_DEFAULTS.crt,
    glass: typeof o.glass === "boolean" ? o.glass : UI_DEFAULTS.glass,
    desktopColor:
      typeof o.desktopColor === "string" && HEX_RE.test(o.desktopColor)
        ? o.desktopColor
        : UI_DEFAULTS.desktopColor,
  };
}

// Accepts both storage shapes — objects ({x,y}, the LS/server doc) and the
// cookie's compact arrays ([x,y]) — so one sanitizer covers both worlds.
function iconEntry(p: unknown): { x: number; y: number } | null {
  let x: unknown;
  let y: unknown;
  if (Array.isArray(p) && p.length === 2) {
    [x, y] = p;
  } else if (typeof p === "object" && p !== null) {
    x = (p as { x?: unknown }).x;
    y = (p as { y?: unknown }).y;
  } else {
    return null;
  }
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < 0 || y < 0 || x > MAX_COORD || y > MAX_COORD) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

/** Bounds-only icon layout sanitize; bad entries drop, never fail the boot. */
export function sanitizeIconPos(v: unknown): IconPos {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out: IconPos = {};
  for (const [k, p] of Object.entries(v as Record<string, unknown>).slice(0, MAX_ICONS)) {
    if (!ICON_KEY_RE.test(k)) continue;
    const e = iconEntry(p);
    if (e) out[k] = e;
  }
  return out;
}

// Cookie payload: ui fields plus "p": {id:[x,y]} (arrays shave two field names
// per icon) and "h": hiddenApps when non-empty. Object insertion order is
// LRU-ish — a move reinserts its key — so when the budget overflows, entries
// drop from the front: icons moved longest ago lose their first-frame hint
// first and settle after hydration instead. "h" is capped small and only drops
// as a last resort.
function encodeCookie(ui: UiPrefs, entries: [string, { x: number; y: number }][], hiddenApps: string[]): string {
  const p: Record<string, [number, number]> = {};
  for (const [k, v] of entries) p[k] = [v.x, v.y];
  return JSON.stringify(hiddenApps.length ? { ...ui, p, h: hiddenApps } : { ...ui, p });
}

export function prefsCookieValue(ui: UiPrefs, iconPos: IconPos, hiddenApps: string[]): string {
  const apps = hiddenApps.slice(0, MAX_HIDDEN_APPS);
  const entries = Object.entries(iconPos);
  let s = encodeCookie(ui, entries, apps);
  while (!fitsCookie(s) && entries.length > 0) {
    entries.shift();
    s = encodeCookie(ui, entries, apps);
  }
  if (!fitsCookie(s)) s = encodeCookie(ui, entries, []); // pathological h: drop it, keep ui
  return s;
}

/** Cookie value → boot prefs; raw may be undefined or percent-encoded garbage.
 *  Cookies from before the "p"/"h" fields simply boot with the default grid. */
export function bootPrefsFromCookieValue(raw: string | undefined): BootPrefs {
  if (!raw) return { ui: UI_DEFAULTS, iconPos: EMPTY_ICON_POS, hiddenApps: [] };
  try {
    const o = JSON.parse(decodeURIComponent(raw)) as { p?: unknown; h?: unknown };
    return {
      ui: sanitizeUi(o),
      iconPos: sanitizeIconPos(o.p),
      hiddenApps: sanitizePrivacy({ hiddenApps: o.h }).hiddenApps,
    };
  } catch {
    return { ui: UI_DEFAULTS, iconPos: EMPTY_ICON_POS, hiddenApps: [] };
  }
}
