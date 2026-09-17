"use client";

// 回收站窗口:真实数据。条目 = 服务端软删的顶层节点(原位置 + 到期时间),
// 恢复回原位(父没了落回桌面),彻底删除连带文章与图片字节,清空一把梭。
// 到期(默认 7 天)由服务端定时 + 启动补扫自动清除,与这里无关。

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDesktop } from "./context";
import { useContextMenu } from "./ContextMenu";
import type { MenuItem } from "./menu";
import { CenterNote } from "./Fs";
import { MenuBar, StatusBar } from "./windows";
import { FolderIcon, MdDocIcon, PhotoIcon, PixelIcon } from "./icons";
import { bumpFsRevision, useFsRevision } from "./fsState";
import { useConnection } from "../../lib/api/mode";
import { useOwnerState } from "../../lib/api/owner";
import { useI18n } from "../../lib/i18n/LanguageContext";
import { emptyTrash, listTrash, purgeFsNode, restoreFsNode } from "../../lib/api/files";
import type { TrashNode } from "../../lib/api/types";

const DAY_MS = 86_400_000;

function binIcon(t: TrashNode["type"]) {
  const sprite = t === "folder" ? FolderIcon : t === "doc" ? MdDocIcon : PhotoIcon;
  return <PixelIcon sprite={sprite} size={16} />;
}

function daysLeft(t: TrashNode): number {
  return Math.max(0, Math.ceil((Date.parse(t.purgeAt) - Date.now()) / DAY_MS));
}

export function BinWindow() {
  const api = useDesktop();
  const { t: tr } = useI18n();
  const menu = useContextMenu();
  const conn = useConnection();
  const ownerState = useOwnerState();
  const revision = useFsRevision();
  const [items, setItems] = useState<TrashNode[] | null>(null);
  // Two-step confirms: per-row purge and the empty-all button each arm for 4 s.
  const [armPurge, setArmPurge] = useState<string | null>(null);
  const [armEmpty, setArmEmpty] = useState(false);
  const purgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (purgeTimer.current) clearTimeout(purgeTimer.current);
      if (emptyTimer.current) clearTimeout(emptyTimer.current);
    },
    [],
  );

  useEffect(() => {
    // 回收站整体是主人专属(doc 08 §1.1):访客(含预览)不取数,渲染层给
    // 锁文案。ownerState dep 让解锁瞬间重取。
    if (conn.status !== "live" || !ownerState.token || ownerState.preview) return;
    let alive = true;
    listTrash()
      .then((ts) => alive && setItems(ts))
      .catch(() => alive && setItems(null));
    return () => {
      alive = false;
    };
  }, [conn.status, revision, ownerState]);

  const armRow = useCallback((id: string) => {
    if (purgeTimer.current) clearTimeout(purgeTimer.current);
    setArmPurge(id);
    purgeTimer.current = setTimeout(() => setArmPurge(null), 4000);
  }, []);

  const restore = useCallback(
    (t: TrashNode) => {
      restoreFsNode(t.id)
        .then(() => bumpFsRevision())
        .catch(() => api.dialog(tr("bin.restore"), [tr("bin.restoreFail"), tr("fs.retry")]));
    },
    [api],
  );

  const purge = useCallback(
    (t: TrashNode) => {
      purgeFsNode(t.id)
        .then(() => bumpFsRevision())
        .catch(() => api.dialog(tr("bin.title"), [tr("bin.purgeFail")]));
    },
    [api],
  );

  const empty = useCallback(() => {
    emptyTrash()
      .then(() => {
        setArmEmpty(false);
        bumpFsRevision();
      })
      .catch(() => api.dialog(tr("bin.title"), [tr("bin.emptyFail")]));
  }, [api]);

  function rowMenu(t: TrashNode, armed: boolean): MenuItem[] {
    return [
      { kind: "item", label: tr("bin.restore"), action: () => restore(t) },
      { kind: "sep" },
      {
        kind: "item",
        label: armed ? tr("bin.confirmPurge") : tr("bin.purge"),
        danger: armed,
        action: armed
          ? () => purge(t)
          : (ctl) => {
              armRow(t.id);
              ctl.reopen(rowMenu(t, true));
            },
      },
    ];
  }

  // The menu factory re-runs per render while open; armed state must come from
  // the ref, not the open-time closure (doc 04 铁律 4).
  const live = useRef({ armPurge, armEmpty });
  useLayoutEffect(() => {
    live.current = { armPurge, armEmpty };
  });
  function openRowMenu(e: Parameters<typeof menu.open>[0], t: TrashNode) {
    menu.open(e, () => rowMenu(t, live.current.armPurge === t.id));
  }

  function blankMenu(): MenuItem[] {
    const has = (items ?? []).length > 0;
    const armed = live.current.armEmpty;
    return [
      {
        kind: "item",
        label: armed ? tr("bin.confirmEmpty") : tr("bin.empty"),
        danger: armed,
        disabled: !has,
        action: armed
          ? () => empty()
          : (ctl) => {
              setArmEmpty(true);
              if (emptyTimer.current) clearTimeout(emptyTimer.current);
              emptyTimer.current = setTimeout(() => setArmEmpty(false), 4000);
              ctl.reopen(blankMenu());
            },
      },
    ];
  }

  // Locked visitors (and the owner rehearsing that view) get the lock story,
  // not the offline story (doc 08) — even with stale items from an owner
  // session still in state.
  if (conn.status === "live" && (!ownerState.token || ownerState.preview))
    return <CenterNote>{tr("bin.private")}<br />{tr("bin.privateHint")}</CenterNote>;
  if (items === null)
    return <CenterNote>{tr("bin.offline")}<br />{tr("bin.offlineHint")}</CenterNote>;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-[2px]">
      <MenuBar items={[tr("menu.file"), tr("menu.edit"), tr("menu.view"), tr("menu.help")]} />
      <div className="flex items-center gap-2 px-1 py-[2px] shrink-0">
        <button
          type="button"
          className={`bevel-thin-out bg-chrome px-3 py-[2px] text-[11px] press disabled:text-black/40 ${
            armEmpty ? "text-[#a00000]" : ""
          }`}
          disabled={!items.length}
          onClick={() => {
            if (armEmpty) {
              empty();
              return;
            }
            setArmEmpty(true);
            if (emptyTimer.current) clearTimeout(emptyTimer.current);
            emptyTimer.current = setTimeout(() => setArmEmpty(false), 4000);
          }}
        >
          {armEmpty ? tr("bin.confirmEmptyShort") : tr("bin.empty")}
        </button>
        <span className="text-[10px] text-black/50 select-none">{tr("bin.keep7desc")}</span>
      </div>
      <div
        className="flex-1 min-h-0 bg-white bevel-in overflow-auto"
        onContextMenu={(e) => {
          if (e.target !== e.currentTarget) return;
          menu.open(e, blankMenu);
        }}
      >
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-[12px] text-black/40 leading-[1.9] px-6">
            {tr("bin.nothing")}
            <br />
            {tr("bin.nothingHint")}
          </div>
        ) : (
          items.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-2 py-[3px] text-[12px] text-black cursor-default group"
              onContextMenu={(e) => openRowMenu(e, t)}
            >
              {binIcon(t.type)}
              <span className="flex-1 truncate group-hover:bg-navy group-hover:text-white">{t.name}</span>
              <span className="w-[130px] shrink-0 truncate text-black/50 group-hover:text-white/70">
                {tr("bin.fromPath").replace("{path}", t.deletedFromPath)}
              </span>
              <span className="w-[64px] shrink-0 text-right text-black/50 group-hover:text-white/70">
                {tr("bin.daysLeft").replace("{days}", String(daysLeft(t)))}
              </span>
            </div>
          ))
        )}
      </div>
      <StatusBar
        left={items.length ? `${items.length} ${tr("fs.items")}` : tr("bin.emptyState")}
        right={items.length ? tr("bin.keep7") : undefined}
      />
    </div>
  );
}
