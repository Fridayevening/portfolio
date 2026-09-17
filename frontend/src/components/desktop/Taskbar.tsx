"use client";

import { useEffect, useState, type ReactNode } from "react";
import StartMenu from "./StartMenu";
import {
  ConsoleIcon,
  FolderIcon,
  LockIcon,
  LockOpenIcon,
  LogoMark,
  MediaIcon,
  PixelIcon,
} from "./icons";
import { useDesktop } from "./context";
import { useOwnerState } from "../../lib/api/owner";
import { useI18n } from "../../lib/i18n/LanguageContext";

export type TaskEntry = {
  id: string;
  title: string;
  icon: ReactNode;
  active: boolean;
};

function Clock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {time ?? "--:--"}
    </span>
  );
}

// Tray key (doc 08): the owner lock's always-there handle. Locked is the loud
// state (full-strength brass); unlocked dims, preview flips the tooltip.
function OwnerKey() {
  const api = useDesktop();
  const { token, preview } = useOwnerState();
  const { t } = useI18n();
  const unlocked = token !== null;
  return (
    <button
      type="button"
      title={unlocked ? (preview ? t("taskbar.ownerLock.preview") : t("taskbar.ownerLock.unlocked")) : t("taskbar.ownerLock.locked")}
      aria-label={t("taskbar.ownerLock")}
      className={`flex items-center ${unlocked && !preview ? "opacity-50" : ""}`}
      onClick={() => api.open("ownerlock")}
    >
      <PixelIcon sprite={unlocked ? LockOpenIcon : LockIcon} size={13} />
    </button>
  );
}

export default function Taskbar({
  entries,
  onToggle,
  startOpen,
  setStartOpen,
}: {
  entries: TaskEntry[];
  onToggle: (id: string) => void;
  startOpen: boolean;
  setStartOpen: (open: boolean) => void;
}) {
  const api = useDesktop();
  const { t } = useI18n();

  const quick = [
    { id: "terminal", label: "Terminal", icon: ConsoleIcon },
    { id: "tools", label: t("taskbar.tools"), icon: FolderIcon },
    { id: "media", label: t("taskbar.media"), icon: MediaIcon },
  ];

  return (
    <footer
      className="taskbar absolute left-0 right-0 bottom-0 h-9 bg-chrome bevel-out flex items-center gap-1 px-[2px] z-[850]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`h-[26px] px-2 flex items-center gap-1 font-bold text-[13px] ${
          startOpen ? "bevel-thin-in bg-[#c7c7c7]" : "bevel-thin-out"
        }`}
        onClick={() => setStartOpen(!startOpen)}
      >
        <PixelIcon sprite={LogoMark} size={18} />
        {t("taskbar.start")}
      </button>

      <span className="w-[3px] h-[22px] bevel-thin-in mx-[2px]" aria-hidden />

      <div className="flex items-center gap-[2px]">
        {quick.map((q) => (
          <button
            key={q.id}
            type="button"
            title={q.label}
            aria-label={q.label}
            className="w-[24px] h-[22px] flex items-center justify-center hover-bevel"
            onClick={() => api.open(q.id)}
          >
            <PixelIcon sprite={q.icon} size={18} />
          </button>
        ))}
      </div>

      <span className="w-[3px] h-[22px] bevel-thin-in mx-[2px]" aria-hidden />

      <div className="flex-1 min-w-0 flex items-center gap-[3px] overflow-hidden">
        {entries.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onToggle(e.id)}
            className={`h-[26px] min-w-0 max-w-[160px] flex items-center gap-1 px-[6px] text-[12px] ${
              e.active ? "bevel-thin-in bg-[#c7c7c7] font-bold" : "bevel-thin-out"
            }`}
          >
            <span className="shrink-0 flex items-center">{e.icon}</span>
            <span className="truncate">{e.title}</span>
          </button>
        ))}
      </div>

      <div className="h-[26px] px-2 flex items-center gap-2 bevel-thin-in text-[12px]">
        <OwnerKey />
        <span aria-hidden>🔊</span>
        <Clock />
      </div>

      {startOpen && <StartMenu onClose={() => setStartOpen(false)} />}
    </footer>
  );
}
