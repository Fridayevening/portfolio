"use client";

// Shared pieces for every fs-item surface (desktop icons, folder-window items):
// the right-click menu factory (with the two-step trash confirm) and the inline
// rename input. The menu factory reads reactive state exclusively through the
// latest-ref inside useFsItemMenu (doc 04 铁律 4 — never the open-time closure).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { useContextMenu } from "./ContextMenu";
import type { MenuItem } from "./menu";
import type { FsNode } from "../../lib/api/types";
import { useI18n } from "../../lib/i18n/LanguageContext";
import type { DictKey } from "../../lib/i18n/dict";

export type FsItemHandlers = {
  /** Connection gate for every item. */
  live: () => boolean;
  /** Owner gate for mutations (doc 08): visitors (and visitor preview) can look
   *  but not touch — matches the server-side 401, keeps the menu honest. */
  isOwner: () => boolean;
  openNode: (n: FsNode) => void;
  beginRename: (n: FsNode) => void;
  trashNode: (n: FsNode) => void;
  cutNode: (n: FsNode) => void;
  copyNode: (n: FsNode) => void;
  /** Privacy toggle (doc 08 §1.1): flips the item's secret flag server-side. */
  toggleSecret: (n: FsNode) => void;
};

function buildFsItemMenu(
  h: FsItemHandlers,
  node: FsNode,
  armed: boolean,
  armNode: (id: string) => void,
  t: (k: DictKey) => string,
): MenuItem[] {
  const live = h.live();
  const editable = live && h.isOwner();
  return [
    { kind: "item", label: t("fs.open"), disabled: !live, action: () => h.openNode(node) },
    { kind: "sep" },
    { kind: "item", label: t("fs.rename"), hint: "F2", disabled: !editable, action: () => h.beginRename(node) },
    {
      kind: "item",
      label: node.secret === true ? t("fs.public") : t("fs.private"),
      // Folders hide their whole subtree read-side; docs hide the linked article too.
      hint: node.type === "folder" ? t("fs.hideFolder") : undefined,
      disabled: !editable,
      action: () => h.toggleSecret(node),
    },
    {
      kind: "item",
      label: armed ? t("fs.confirmTrash") : t("fs.delete"),
      danger: armed,
      disabled: !editable,
      // The unarmed click arms + reopens in place as the armed variant (same
      // anchor); the armed click deletes. The arm lives in caller state so every
      // re-render of the open menu keeps reading it (4 s later it self-disarms).
      action: armed
        ? () => h.trashNode(node)
        : (ctl) => {
            armNode(node.id);
            ctl.reopen(buildFsItemMenu(h, node, true, armNode, t));
          },
    },
    { kind: "sep" },
    { kind: "item", label: t("fs.cut"), hint: "Ctrl+X", disabled: !editable, action: () => h.cutNode(node) },
    { kind: "item", label: t("fs.copy"), hint: "Ctrl+C", disabled: !editable, action: () => h.copyNode(node) },
  ];
}

/** Right-click menu for one fs item. `handlers` may close over fresh state every
 *  render — the hook re-reads it through a ref on every commit. `onOpen` fires
 *  on menu open (select the node, …). */
export function useFsItemMenu(handlers: FsItemHandlers, onOpen?: (n: FsNode) => void) {
  const menu = useContextMenu();
  const { t } = useI18n();
  const [arm, setArm] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef({ handlers, arm });
  useLayoutEffect(() => {
    live.current = { handlers, arm };
  });

  const armNode = useCallback((id: string) => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArm(id);
    disarmTimer.current = setTimeout(() => setArm(null), 4000);
  }, []);
  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const openItemMenu = useCallback(
    (e: Parameters<typeof menu.open>[0], node: FsNode) => {
      onOpen?.(node);
      menu.open(e, () => {
        const { handlers: h, arm: a } = live.current;
        return buildFsItemMenu(h, node, a === node.id, armNode, t);
      });
    },
    [menu, onOpen, armNode, t],
  );

  return { openItemMenu };
}

/**
 * Inline rename input (Paper shelf lineage): Enter/blur commit, Escape cancels,
 * IME composition owns Enter until the candidate lands. `selectTo` limits the
 * initial selection to the stem so typing replaces the name, not the extension.
 */
export function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  selectTo,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  /** Select [0, selectTo) instead of the whole value. */
  selectTo?: number;
}) {
  const onKeyDown = (e: RKeyboardEvent<HTMLInputElement>) => {
    // Editing swallows its own keys: the hosting icon handles Enter (open),
    // Space (select) and F2 (rename-again) — bubbling would fire all three
    // mid-edit (Paper's shelf never noticed: its container has no key handlers).
    e.stopPropagation();
    if (e.key === "Enter" && !e.nativeEvent.isComposing) onCommit();
    else if (e.key === "Escape") onCancel();
  };
  return (
    <input
      value={value}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
      onBlur={onCommit}
      autoFocus
      onFocus={(e) => {
        if (selectTo !== undefined && selectTo >= 0 && selectTo < e.currentTarget.value.length) {
          e.currentTarget.setSelectionRange(0, selectTo);
        } else {
          e.currentTarget.select();
        }
      }}
      className="w-full bevel-thin-in bg-white px-[2px] py-0 text-[12px] leading-tight text-black outline-none"
    />
  );
}

/** Character index where the name's stem ends (extension left unselected). */
export function stemEnd(node: FsNode): number | undefined {
  const ext = node.type === "doc" ? ".md" : node.type === "image" ? node.ext ?? ".png" : "";
  return ext && node.name.endsWith(ext) ? node.name.length - ext.length : undefined;
}
