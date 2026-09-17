"use client";

import { useState } from "react";
import { useDesktop } from "./context";
import { PixelIcon, RepairTvIcon } from "./icons";
import { useOwnerState } from "../../lib/api/owner";
import { useConnection } from "../../lib/api/mode";
import { setDefaultSecret, setHiddenApp, usePrivacyPrefs } from "./prefsState";
import { useI18n } from "../../lib/i18n/LanguageContext";
import type { DictKey } from "../../lib/i18n/dict";

// Classic desktop fills from the 95-era palette: the dark VGA hues every office
// monitor wore, plus the Win98 sky blue. Wallpaper upload is a later-Windows
// luxury — this control panel ships colors only.
const COLORS: { name: DictKey; hex: string }[] = [
  { name: "color.teal", hex: "#008080" },
  { name: "color.navy", hex: "#000080" },
  { name: "color.sky", hex: "#3a6ea5" },
  { name: "color.forest", hex: "#008000" },
  { name: "color.plum", hex: "#800080" },
  { name: "color.wine", hex: "#800000" },
  { name: "color.olive", hex: "#808000" },
  { name: "color.black", hex: "#000000" },
];

function Check({
  checked,
  onChange,
  label,
  desc,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? "text-black/40" : ""}`}>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span
        aria-hidden
        className="mt-[1px] w-[13px] h-[13px] shrink-0 bg-white bevel-thin-in flex items-center justify-center text-[11px] leading-none font-bold"
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-[12px] leading-[1.4] flex-1">
        {label}
        <span className="block text-[11px] text-black/50">{desc}</span>
      </span>
    </label>
  );
}

/** Compact checkbox for the per-app list (no desc line — the list is long). */
function MiniCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-[5px]">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden
        className="w-[12px] h-[12px] shrink-0 bg-white bevel-thin-in flex items-center justify-center text-[10px] leading-none font-bold"
      >
        {checked ? "✓" : ""}
      </span>
      <span className="text-[11px] leading-[1.5] truncate">{label}</span>
    </label>
  );
}

// Hideable apps (doc 08 §1.2): every static desk-icon id plus market (opens
// from the alert toast). settings/ownerlock stay — they're the way back in.
const HIDEABLE_APPS: [string, DictKey][] = [
  ["mycomputer", "app.myComputer"],
  ["tools", "app.tools"],
  ["lab", "app.lab"],
  ["work", "portfolio.work.title"],
  ["research", "portfolio.research.title"],
  ["notes", "app.notes.txt"],
  ["readme", "app.readme.txt"],
  ["media", "app.media"],
  ["terminal", "app.terminalName"],
  ["monitor", "app.monitor"],
  ["stickies", "app.stickies.name"],
  ["nes", "app.nes.name"],
  ["mines", "app.mines"],
  ["paper", "app.paper"],
  ["imgtool", "app.imgtool"],
  ["imglab", "app.imglab"],
  ["aespu", "app.aespu"],
  ["young", "app.young"],
  ["repair", "app.repair"],
  ["mail", "app.mail"],
  ["bazinga", "app.bazinga"],
  ["market", "app.market"],
];

// The live mini tube: whatever the desktop wears right now, at 1/12 scale. The
// overlays reuse the real .scanlines/.vignette so the preview and the screen age
// together — only the curvature is a scaled-down class of its own.
function MonitorPreview({
  color,
  crt,
  glass,
}: {
  color: string;
  crt: boolean;
  glass: boolean;
}) {
  return (
    <div className="flex flex-col items-center select-none">
      <div className="bg-chrome bevel-out rounded-t-[6px] px-[9px] pt-[7px] pb-[9px]">
        <div
          className={`relative w-[148px] h-[108px] overflow-hidden ${crt ? "crt-flicker" : ""} ${
            crt && glass ? "crt-prev-glass" : ""
          }`}
          style={{ background: color }}
        >
          {/* Tiny desktop mock: two icons, one window, the taskbar */}
          <span className="absolute left-[7px] top-[6px] w-[6px] h-[6px] bg-white/90" aria-hidden />
          <span className="absolute left-[7px] top-[18px] w-[6px] h-[6px] bg-white/90" aria-hidden />
          <span
            className="absolute left-[32px] top-[22px] w-[80px] h-[42px] bg-chrome bevel-out flex flex-col p-[2px]"
            aria-hidden
          >
            <span className="h-[8px] titlebar-active flex items-center px-[2px]">
              <span className="w-[3px] h-[3px] bg-white" />
            </span>
            <span className="flex-1 bg-white m-[1px] mt-[2px]" />
          </span>
          <span
            className="absolute inset-x-0 bottom-0 h-[9px] bg-chrome shadow-[inset_0_1px_0_#fff] flex items-center px-[2px] gap-[2px]"
            aria-hidden
          >
            <span className="w-[13px] h-[7px] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] flex items-center justify-center">
              <span className="w-[3px] h-[3px] bg-[#33ff66]" />
            </span>
            <span className="w-[16px] h-[7px] shadow-[inset_-1px_-1px_#fff,inset_1px_1px_#808080]" />
          </span>
          {crt && <span className="scanlines" aria-hidden />}
          {crt && <span className="vignette" aria-hidden />}
        </div>
      </div>
      <div className="w-[40px] h-[9px] bg-chrome bevel-out" aria-hidden />
      <div className="w-[84px] h-[8px] bg-chrome bevel-out" aria-hidden />
    </div>
  );
}

export default function Settings() {
  const api = useDesktop();
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = useState<"fx" | "bg" | "privacy" | "lang">("fx");
  const conn = useConnection();
  const ownerState = useOwnerState();
  const privacy = usePrivacyPrefs();
  // Everything here applies live, so 取消 is the only memory of "before": the
  // snapshot taken when the sheet opened.
  const [snapshot] = useState(() => ({
    crt: api.crt,
    glass: api.glass,
    color: api.desktopColor,
  }));

  const tabs: [typeof tab, DictKey][] = [
    ["fx", "settings.tab.fx"],
    ["bg", "settings.tab.bg"],
    ["privacy", "settings.tab.privacy"],
    ["lang", "settings.tab.lang"],
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab strip: same wtab control as PAPER, the connected-page look */}
      <div className="flex items-end gap-[2px] px-[4px] shrink-0">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`wtab h-[20px] pl-[8px] pr-[12px] text-[11px] ${
              tab === id ? "wtab-on bg-white font-bold" : "bg-chrome mt-[1px]"
            }`}
            onClick={() => setTab(id)}
          >
            {t(label)}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 bg-white bevel-in p-3 flex flex-col gap-3 overflow-auto">
        {tab !== "privacy" && (
          <div className="flex justify-center pt-1 shrink-0">
            <MonitorPreview color={api.desktopColor} crt={api.crt} glass={api.glass && api.crt} />
          </div>
        )}

        {tab === "privacy" ? (
          <div className="flex flex-col gap-[10px] px-2 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px]">
                {ownerState.token
                  ? ownerState.preview
                    ? t("settings.privacy.unlockedPreview")
                    : t("settings.privacy.unlockedOwner")
                  : t("settings.privacy.locked")}
              </span>
              <button
                type="button"
                className="bevel-thin-out bg-chrome px-3 py-[3px] text-[12px] press"
                onClick={() => api.open("ownerlock")}
              >
                {t("settings.privacy.ownerLock")}
              </button>
            </div>
            <Check
              checked={privacy.defaultSecret}
              onChange={() => setDefaultSecret(!privacy.defaultSecret)}
              label={t("settings.privacy.defaultSecret")}
              desc={t("settings.privacy.defaultSecret.desc")}
            />
            <div>
              <p className="text-[12px] mb-[5px]">{t("settings.privacy.hiddenApps")}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-[3px]">
                {HIDEABLE_APPS.map(([id, label]) => (
                  <MiniCheck
                    key={id}
                    label={t(label)}
                    checked={privacy.hiddenApps.includes(id)}
                    onChange={() => setHiddenApp(id, !privacy.hiddenApps.includes(id))}
                  />
                ))}
              </div>
              <p className="text-[11px] text-black/50 mt-[8px]">
                {t("settings.privacy.hiddenNote")}
              </p>
            </div>
            {conn.status !== "live" && (
              <p className="text-[11px] text-black/50">
                {t("settings.privacy.localMode")}
              </p>
            )}
            <p className="text-[11px] text-black/50">
              {t("settings.privacy.stickyNote")}
            </p>
          </div>
        ) : tab === "fx" ? (
          <div className="flex flex-col gap-[10px] px-2 pb-1">
            <Check
              checked={api.crt}
              onChange={api.toggleCrt}
              label={t("settings.fx.crt")}
              desc={t("settings.fx.crt.desc")}
            />
            {/* Curvature rides on the dressing, so the option sleeps with it off */}
            <Check
              checked={api.glass && api.crt}
              disabled={!api.crt}
              onChange={api.toggleGlass}
              label={t("settings.fx.glass")}
              desc={t("settings.fx.glass.desc")}
            />
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <button
                type="button"
                className="bevel-thin-out bg-chrome px-3 py-[3px] text-[12px] press flex items-center gap-2"
                onClick={api.repair}
              >
                <PixelIcon sprite={RepairTvIcon} size={14} />
                {t("settings.fx.repair")}
              </button>
              <span className="text-[11px] text-black/50">
                {t("settings.fx.repair.desc")}
              </span>
            </div>
          </div>
        ) : tab === "lang" ? (
          <div className="px-2 pb-1 flex flex-col gap-[10px]">
            <p className="text-[12px] mb-[2px]">{t("settings.tab.lang")}</p>
            <div className="flex gap-[6px]">
              <button
                type="button"
                className={`px-3 py-[3px] text-[12px] press ${
                  lang === "zh" ? "bevel-thin-in bg-[#c7c7c7] font-bold" : "bevel-thin-out bg-chrome"
                }`}
                onClick={() => setLang("zh")}
              >
                {t("lang.zh")}
              </button>
              <button
                type="button"
                className={`px-3 py-[3px] text-[12px] press ${
                  lang === "en" ? "bevel-thin-in bg-[#c7c7c7] font-bold" : "bevel-thin-out bg-chrome"
                }`}
                onClick={() => setLang("en")}
              >
                {t("lang.en")}
              </button>
            </div>
            <p className="text-[11px] text-black/50">{t("settings.langNote")}</p>
          </div>
        ) : (
          <div className="px-2 pb-1">
            <p className="text-[12px] mb-[6px]">{t("settings.bg.color")}</p>
            <div className="grid grid-cols-4 gap-[6px]">
              {COLORS.map((c) => {
                const sel = api.desktopColor === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    aria-pressed={sel}
                    className="flex flex-col items-center gap-[3px]"
                    onClick={() => api.setDesktopColor(c.hex)}
                  >
                    <span
                      className={`relative w-full h-[26px] ${sel ? "bevel-thin-in" : "bevel-thin-out"}`}
                      style={{ background: c.hex }}
                    >
                      {sel && (
                        <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold text-white">
                          ✓
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] leading-none">{t(c.name)}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-black/50 mt-[10px]">
              {t("settings.bg.note")}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-[6px] p-[6px] pt-[4px] shrink-0">
        <button
          type="button"
          className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
          onClick={() => api.close("settings")}
        >
          {t("settings.ok")}
        </button>
        <button
          type="button"
          className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
          onClick={() => {
            if (api.crt !== snapshot.crt) api.toggleCrt();
            if (api.glass !== snapshot.glass) api.toggleGlass();
            api.setDesktopColor(snapshot.color);
            api.close("settings");
          }}
        >
          {t("settings.cancel")}
        </button>
        <button
          type="button"
          className="w-[72px] bevel-thin-out bg-chrome py-[3px] text-[12px] press"
          onClick={(e) => api.tip(e.currentTarget, t("settings.applyTip"))}
        >
          {t("settings.apply")}
        </button>
      </div>
    </div>
  );
}
