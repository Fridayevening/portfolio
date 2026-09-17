"use client";

// 主人之锁窗口(doc 08 §1.3):口令解锁 / 上锁 + 访客预览排练。Win95 密码
// 对话框的味 —— 小 sheet、password 输入、Enter 提交(RunWindow 是模板)。
// 身份切换后各数据面自动按新视角重取:桌面/文件夹窗/回收站/Paper 的 fetch
// effect 都挂了 owner 状态依赖,这里不需要手动刷新。

import { useState } from "react";
import { PixelIcon, LockIcon, LockOpenIcon } from "./icons";
import { useDesktop } from "./context";
import { unlockOwner } from "../../lib/api/auth";
import { owner, useOwnerState } from "../../lib/api/owner";
import { useConnection } from "../../lib/api/mode";
import { ApiError } from "../../lib/api/client";
import { useI18n } from "../../lib/i18n/LanguageContext";

export default function OwnerLock() {
  const { t } = useI18n();
  const api = useDesktop();
  const conn = useConnection();
  const { token, preview } = useOwnerState();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const live = conn.status === "live";
  const unlocked = token !== null;

  const submit = async () => {
    const pw = value.trim();
    if (!pw || busy) return;
    setBusy(true);
    setError(null);
    try {
      await unlockOwner(pw);
      owner.unlock(pw);
      setValue("");
    } catch (e) {
      // The server's Chinese message (口令不对 / 节流) plays as-is; anything
      // else is the plain network story.
      const msg = e instanceof ApiError ? (e.payload as { message?: unknown } | undefined)?.message : undefined;
      setError(typeof msg === "string" ? msg : t("lock.fail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 p-2 text-[12px]">
      <div className="flex gap-3">
        <PixelIcon sprite={unlocked ? LockOpenIcon : LockIcon} size={32} className="shrink-0 mt-1" />
        <div className="flex-1 leading-[1.6] min-w-0">
          {!live ? (
            <>{t("lock.offline")}</>
          ) : unlocked ? (
            <>
              {t("lock.unlocked")}
              {preview && <span className="block text-[11px] text-black/60">{t("lock.preview")}</span>}
            </>
          ) : (
            <label className="block">
              {t("lock.prompt")}
              <input
                type="password"
                value={value}
                disabled={busy}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                  else if (e.key === "Escape") api.close("ownerlock");
                }}
                spellCheck={false}
                autoComplete="off"
                autoFocus
                className="mt-1 w-full bg-white bevel-thin-in px-2 py-[3px] text-[13px] outline-none"
              />
            </label>
          )}
        </div>
      </div>

      {live && unlocked && (
        <label className="flex items-start gap-2 px-1">
          <input
            type="checkbox"
            className="sr-only"
            checked={preview}
            onChange={() => owner.setPreview(!preview)}
          />
          <span
            aria-hidden
            className="mt-[1px] w-[13px] h-[13px] shrink-0 bg-white bevel-thin-in flex items-center justify-center text-[11px] leading-none font-bold"
          >
            {preview ? "✓" : ""}
          </span>
          <span className="text-[12px] leading-[1.4] flex-1">
            {t("lock.previewBtn")}
            <span className="block text-[11px] text-black/50">{t("lock.previewDesc")}</span>
          </span>
        </label>
      )}

      {error && <p className="text-[11px] text-[#800000] px-1 -mt-1">{error}</p>}

      <div className="flex justify-end gap-2 mt-auto">
        {live && !unlocked && (
          <button type="button" className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press" disabled={busy} onClick={() => void submit()}>
            {t("lock.unlock")}
          </button>
        )}
        {live && unlocked && (
          <button
            type="button"
            className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
            onClick={() => owner.lock()}
          >
            {t("lock.lock")}
          </button>
        )}
        <button
          type="button"
          className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
          onClick={() => api.close("ownerlock")}
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
