"use client";

// Dynamic windows and dispatch for the desktop file system. Window contents fetch
// their own data because openDef captures render closures at registration time.
// Closures only carry immutable ids and names; children and image metadata load after
// mount to avoid stale open-time snapshots. Shared mutations bump the revision so
// every desktop and folder surface refreshes together.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDesktop, type DesktopApi } from "./context";
import { useContextMenu } from "./ContextMenu";
import type { MenuItem } from "./menu";
import { RenameInput, stemEnd, useFsItemMenu } from "./fsMenu";
import { bumpFsRevision, getFsClipboard, setFsClipboard, useFsClipboard, useFsRevision, type FsClip } from "./fsState";
import { FolderView, PhotoWindow } from "./windows";
import { FolderIcon, LockBadge, MdDocIcon, PhotoIcon, PixelIcon } from "./icons";
import { openArticleInPaper } from "./Paper";
import { peekPrivacy } from "./prefsState";
import { useConnection } from "../../lib/api/mode";
import { useOwnerState, isVisitorView } from "../../lib/api/owner";
import { ApiError } from "../../lib/api/client";
import {
  copyFsNode,
  createFsNode,
  fsImageUrl,
  getFsNode,
  listFsNodes,
  moveFsNode,
  renameFsNode,
  setFsNodeSecret,
  trashFsNode,
} from "../../lib/api/files";
import type { FsNode, FsType } from "../../lib/api/types";
import { currentT } from "../../lib/i18n/dict";
import { useI18n } from "../../lib/i18n/LanguageContext";

// Repeated opens cascade instead of stacking dead-on; wraps after 5.
let cascade = 0;
function geomFor(w: number, h: number) {
  const o = (cascade++ % 5) * 22;
  return { w, h, x: 240 + o, y: 130 + o };
}

function iconFor(t: FsType, size = 32) {
  const sprite = t === "folder" ? FolderIcon : t === "doc" ? MdDocIcon : PhotoIcon;
  return <PixelIcon sprite={sprite} size={size} />;
}

/** Icon plus private lock badge, shared by folders, documents, and images. */
function iconWithSecret(n: FsNode, size = 32) {
  if (n.secret !== true) return iconFor(n.type, size);
  return (
    <span className="relative inline-flex">
      {iconFor(n.type, size)}
      <LockBadge />
    </span>
  );
}

/** Double-click dispatch, shared by the desktop surface and folder windows. */
export function openFsChild(api: DesktopApi, node: FsNode) {
  if (node.type === "folder") {
    api.openDef(folderWindowDef(node));
    return;
  }
  if (node.type === "doc") {
    if (node.articleId) openArticleInPaper(api, node.articleId);
    else api.dialog(currentT("fs.sysError"), [currentT("fs.docMissing"), currentT("fs.dbForgot")]);
    return;
  }
  api.openDef({
    id: `fs-${node.id}`,
    title: currentT("fs.preview").replace("{name}", node.name),
    icon: <PixelIcon sprite={PhotoIcon} size={14} />,
    ...geomFor(460, 420),
    render: () => <FsPhotoWindow nodeId={node.id} />,
  });
}

function folderWindowDef(node: FsNode) {
  return {
    id: `fs-${node.id}`,
    title: node.name,
    icon: <PixelIcon sprite={FolderIcon} size={14} />,
    ...geomFor(460, 330),
    render: () => <FsFolderWindow folderId={node.id} />,
  };
}

/** After a rename, retarget the ALREADY-OPEN folder window: re-openDef on the
 *  same id swaps the def (titlebar + taskbar follow) while keeping position.
 *  Never opens a window for a folder the user never opened. */
export function refreshFolderWindow(api: DesktopApi, node: FsNode) {
  if (!api.isOpen(`fs-${node.id}`)) return;
  api.openDef(folderWindowDef(node));
}

/** Create with the default privacy preference, refresh surfaces, and open new documents. */
export async function createFsChild(api: DesktopApi, type: FsType, parent?: string): Promise<void> {
  try {
    const node = await createFsNode({ type, parent, secret: peekPrivacy().defaultSecret });
    bumpFsRevision();
    if (type === "doc" && node.articleId) openArticleInPaper(api, node.articleId);
  } catch {
    api.dialog(currentT("fs.new"), [currentT("fs.createFail"), currentT("fs.offlineFiles")]);
  }
}

/** Toggle privacy and refresh every surface under the current viewer identity. */
export async function toggleSecretFs(api: DesktopApi, n: FsNode): Promise<void> {
  try {
    await setFsNodeSecret(n.id, n.secret !== true);
    bumpFsRevision();
  } catch {
    api.dialog(currentT("fs.privateLabel"), [currentT("fs.opFail"), currentT("fs.connectLater")]);
  }
}

/** Trash a subtree, close its windows, clear matching clipboard state, then refresh. */
export async function trashFsDeep(api: DesktopApi, id: string): Promise<void> {
  try {
    const { trashed } = await trashFsNode(id);
    for (const tid of trashed) api.close(`fs-${tid}`);
    const clip = getFsClipboard();
    if (clip && trashed.includes(clip.id)) setFsClipboard(null);
    bumpFsRevision();
  } catch {
    api.dialog(currentT("fs.delete"), [currentT("fs.deleteFail"), currentT("fs.retry")]);
  }
}

/** Copy remains reusable; cut clears after paste, and missing sources clear the clipboard. */
export async function pasteFs(api: DesktopApi, parent: string | null): Promise<void> {
  const clip = getFsClipboard();
  if (!clip) return;
  try {
    if (clip.mode === "copy") await copyFsNode(clip.id, parent);
    else {
      await moveFsNode(clip.id, parent);
      setFsClipboard(null);
    }
    bumpFsRevision();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      setFsClipboard(null);
      api.dialog(currentT("fs.paste"), [currentT("fs.pasteGone"), currentT("fs.pasteGoneHint")]);
    } else {
      api.dialog(currentT("fs.paste"), [currentT("fs.pasteFail"), currentT("fs.retry")]);
    }
  }
}

export function CenterNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0 bg-white bevel-in flex items-center justify-center text-center text-[13px] text-black/50 leading-[1.9] px-6">
      {children}
    </div>
  );
}

export function FsFolderWindow({ folderId }: { folderId: string }) {
  const api = useDesktop();
  const { t } = useI18n();
  const menu = useContextMenu();
  const conn = useConnection();
  const ownerState = useOwnerState();
  const clip = useFsClipboard();
  const revision = useFsRevision();
  const [nodes, setNodes] = useState<FsNode[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  useEffect(() => {
    // folderId is stable per mount (the window id embeds it); null = loading or
    // offline, same panel either way. The revision counter covers every mutation
    // — this window's own and any other surface's. ownerState re-asks under the
    // new viewer on unlock/lock/preview (doc 08).
    if (conn.status !== "live") return;
    let alive = true;
    listFsNodes(folderId)
      .then((ns) => alive && setNodes(ns))
      .catch(() => alive && setNodes(null));
    return () => {
      alive = false;
    };
  }, [folderId, conn.status, revision, ownerState]);

  const doRename = useCallback(
    async (n: FsNode, raw: string) => {
      setRenameId(null);
      const name = raw.trim().slice(0, 100);
      if (!name || name === n.name) return;
      try {
        const updated = await renameFsNode(n.id, name);
        // A renamed child folder may have its own window open elsewhere.
        if (n.type === "folder") refreshFolderWindow(api, updated);
        bumpFsRevision();
      } catch (e) {
        // Refetch restores the old label; the dialog explains why.
        bumpFsRevision();
        api.dialog(
          t("fs.rename"),
          e instanceof ApiError && e.status === 400
            ? [t("fs.dup"), t("fs.dupHint")]
            : [t("fs.renameFail"), t("fs.connectLater")],
        );
      }
    },
    [api],
  );

  const beginRename = useCallback((n: FsNode) => {
    setSelId(n.id);
    setRenameId(n.id);
    setRenameVal(n.name);
  }, []);

  const { openItemMenu } = useFsItemMenu(
    {
      live: () => conn.status === "live",
      isOwner: () => !isVisitorView(),
      openNode: (n) => openFsChild(api, n),
      beginRename,
      trashNode: (n) => void trashFsDeep(api, n.id),
      cutNode: (n) => setFsClipboard({ mode: "cut", id: n.id }),
      copyNode: (n) => setFsClipboard({ mode: "copy", id: n.id }),
      toggleSecret: (n) => void toggleSecretFs(api, n),
    },
    (n) => setSelId(n.id),
  );

  // The blank-area menu factory reads through this ref to avoid stale closures.
  const blankLive = useRef<{
    live: boolean;
    owner: boolean;
    clip: FsClip | null;
    create: (t: FsType) => void;
    paste: () => void;
  }>({ live: false, owner: false, clip: null, create: () => {}, paste: () => {} });
  useLayoutEffect(() => {
    blankLive.current = {
      live: conn.status === "live",
      owner: !isVisitorView(),
      clip,
      create: (t: FsType) => void createFsChild(api, t, folderId),
      paste: () => void pasteFs(api, folderId),
    };
  });
  function blankMenu(): MenuItem[] {
    const { live, owner, create, paste, clip: c } = blankLive.current;
    // Disable writes for visitors and preview mode, matching the server's 401 policy.
    const writable = live && owner;
    return [
      { kind: "item", label: t("fs.newFolder"), icon: <PixelIcon sprite={FolderIcon} size={14} />, disabled: !writable, action: () => create("folder") },
      { kind: "item", label: t("fs.newDoc"), icon: <PixelIcon sprite={MdDocIcon} size={14} />, disabled: !writable, action: () => create("doc") },
      { kind: "item", label: t("fs.newImage"), icon: <PixelIcon sprite={PhotoIcon} size={14} />, disabled: !writable, action: () => create("image") },
      { kind: "sep" },
      { kind: "item", label: t("fs.paste"), hint: "Ctrl+V", disabled: !(writable && c), action: () => paste() },
    ];
  }

  if (nodes === null) return <CenterNote>{t("fs.offline")}<br />{t("fs.offlineFiles")}</CenterNote>;

  return (
    <FolderView
      items={nodes.map((n) => ({
        id: n.id,
        label:
          renameId === n.id ? (
            <RenameInput
              value={renameVal}
              onChange={setRenameVal}
              onCommit={() => void doRename(n, renameVal)}
              onCancel={() => setRenameId(null)}
              selectTo={stemEnd(n)}
            />
          ) : (
            n.name
          ),
        icon: iconWithSecret(n),
        onOpen: () => openFsChild(api, n),
        onSelect: () => setSelId(n.id),
        selected: selId === n.id,
        dimmed: clip?.mode === "cut" && clip.id === n.id,
        onContextMenu: (e) => openItemMenu(e, n),
        onKeyDown: (e) => {
          if (e.key === "F2") {
            e.preventDefault();
            beginRename(n);
          }
        },
      }))}
      countLabel={`${nodes.length} ${t("fs.items")}`}
      bytesLabel={`${nodes.reduce((s, n) => s + (n.size ?? 0), 0).toLocaleString()} ${t("fs.bytes")}`}
      onBlankContextMenu={(e) => menu.open(e, blankMenu)}
    />
  );
}

export function FsPhotoWindow({ nodeId }: { nodeId: string }) {
  const { t } = useI18n();
  const [node, setNode] = useState<FsNode | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    getFsNode(nodeId)
      .then((n) => alive && setNode(n))
      .catch(() => alive && setNode(null));
    return () => {
      alive = false;
    };
  }, [nodeId]);

  // null base URL only happens in production without NEXT_PUBLIC_API_URL — the
  // image was created online, so this is a degraded browse, not a broken link.
  const url = fsImageUrl(nodeId);
  if (node === null || (node !== undefined && !url)) {
    return <CenterNote>{t("fs.offlineImg")}<br />{t("fs.offlineFiles")}</CenterNote>;
  }
  if (node === undefined || !url) return <CenterNote>{t("fs.opening")}</CenterNote>;

  return (
    <PhotoWindow src={url} file={node.name} caption={t("fs.placeholder").replace("{mime}", node.mime ?? "image/png")} />
  );
}
