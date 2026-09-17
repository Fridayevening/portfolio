"use client";

// Cross-surface desktop-fs state: the clipboard (cut/copy target) and a revision
// counter every successful mutation bumps. Both live outside React on purpose —
// the consumers include dynDefs window render closures, which must never capture
// a stale snapshot (lib/api/mode.ts is the store template). Every mutation calls
// bumpFsRevision(); Desktop, folder windows and the bin refetch off the counter.

import { useSyncExternalStore } from "react";

export type FsClip = { mode: "cut" | "copy"; id: string };

let clip: FsClip | null = null;
const clipListeners = new Set<() => void>();

/** Imperative read (mutation flows outside React, e.g. pasteFs/trashFsDeep). */
export function getFsClipboard(): FsClip | null {
  return clip;
}

/** Set or clear the clipboard (null clears; a cut clears itself after paste). */
export function setFsClipboard(next: FsClip | null): void {
  clip = next;
  clipListeners.forEach((l) => l());
}

export function useFsClipboard(): FsClip | null {
  return useSyncExternalStore(
    (l) => {
      clipListeners.add(l);
      return () => clipListeners.delete(l);
    },
    () => clip,
    () => null,
  );
}

let revision = 0;
const revListeners = new Set<() => void>();

/** Signal that fs data changed server-side; subscribers refetch. */
export function bumpFsRevision(): void {
  revision += 1;
  revListeners.forEach((l) => l());
}

export function useFsRevision(): number {
  return useSyncExternalStore(
    (l) => {
      revListeners.add(l);
      return () => revListeners.delete(l);
    },
    () => revision,
    () => 0,
  );
}
