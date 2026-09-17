"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Lang } from "../../lib/i18n/dict";

/**
 * Window registered at runtime, outside the static WIN_DEFS table — opened by programs
 * themselves (e.g. the image tool's zoom-check window). openDef with an existing id
 * swaps content and refocuses instead of opening a second window.
 */
export type DynamicWindowDef = {
  id: string;
  title: string;
  titleByLang?: Record<Lang, string>;
  icon: ReactNode;
  w: number;
  h: number;
  x: number;
  y: number;
  noResize?: boolean;
  render: () => ReactNode;
};

export type DesktopApi = {
  open: (id: string) => void;
  close: (id: string) => void;
  /** Whether a window with this id exists right now (open or minimized). */
  isOpen: (id: string) => boolean;
  openDef: (def: DynamicWindowDef) => void;
  /** Program-side resize of an already-open window (e.g. imglab fitting itself to a
   *  photo). Size is clamped to the viewport and the position pulled back on-screen;
   *  no-op for unknown ids. */
  fit: (id: string, w: number, h: number) => void;
  dialog: (title: string, lines: string[], type?: "error" | "info") => void;
  tip: (anchor: HTMLElement | null, text: string) => void;
  shutdown: () => void;
  glass: boolean;
  toggleGlass: () => void;
  /** Master switch for the CRT dressing (scanlines, vignette, flicker, curvature). */
  crt: boolean;
  toggleCrt: () => void;
  /** Opens the REPAIR.EXE whack-a-spark game (same as the desktop TV icon). */
  repair: () => void;
  /** Current desktop fill as a hex string (the --desktop token's value). */
  desktopColor: string;
  setDesktopColor: (hex: string) => void;
};

export const DesktopContext = createContext<DesktopApi | null>(null);

export function useDesktop(): DesktopApi {
  const ctx = useContext(DesktopContext);
  if (!ctx) throw new Error("useDesktop must be used inside DesktopProvider");
  return ctx;
}
