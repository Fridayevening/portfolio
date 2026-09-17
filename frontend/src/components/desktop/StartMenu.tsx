"use client";

import type { ReactNode } from "react";
import { useDesktop } from "./context";
import {
  CartridgeIcon,
  ChartIcon,
  ConsoleIcon,
  DisplayIcon,
  FolderIcon,
  GearIcon,
  HelpIcon,
  JoystickIcon,
  LockIcon,
  LogoMark,
  MediaIcon,
  MineIcon,
  NoteIcon,
  PixelIcon,
  PowerIcon,
  SearchIcon,
  TxtIcon,
} from "./icons";
import { useOwnerState } from "../../lib/api/owner";
import { usePrivacyPrefs } from "./prefsState";
import { useI18n } from "../../lib/i18n/LanguageContext";

type MenuItem =
  | {
      kind: "item";
      label: ReactNode;
      icon: ReactNode;
      action?: () => void;
      sub?: MenuItem[];
      /** Curation id (doc 08 §1.2): the entry vanishes for visitors when the id
       *  is in hiddenApps. Explicit per entry — dialog-only leaves never set it. */
      hideId?: string;
    }
  | { kind: "sep" };

/** Drop hidden apps (and groups left empty by that) from the visitor's menu. */
function filterMenu(items: MenuItem[], hidden: Set<string>): MenuItem[] {
  const out: MenuItem[] = [];
  for (const it of items) {
    if (it.kind === "sep") {
      out.push(it);
      continue;
    }
    if (it.hideId && hidden.has(it.hideId)) continue;
    const sub = it.sub ? filterMenu(it.sub, hidden) : undefined;
    if (sub && sub.length === 0) continue;
    out.push(sub ? { ...it, sub } : it);
  }
  return out;
}

function Row({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  if (item.kind === "sep") {
    return <li className="my-[3px] mx-[2px] h-[2px] bevel-thin-in" aria-hidden />;
  }
  const it = item;
  return (
    <li className="relative group/menu">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2 py-[5px] text-left hover:bg-navy hover:text-white"
        onClick={() => {
          if (it.sub) return;
          it.action?.();
          onClose();
        }}
      >
        <span className="shrink-0 flex items-center">{it.icon}</span>
        <span className="flex-1 text-[13px]">{it.label}</span>
        {it.sub && <span className="text-[10px] shrink-0">▶</span>}
      </button>
      {it.sub && (
        <ul className="absolute left-full top-[-3px] z-10 min-w-[190px] bg-chrome bevel-out p-[3px] hidden group-hover/menu:block">
          {it.sub.map((s, i) => (
            <Row key={i} item={s} onClose={onClose} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function StartMenu({ onClose }: { onClose: () => void }) {
  const api = useDesktop();
  const { t } = useI18n();
  const ownerState = useOwnerState();
  const storePrivacy = usePrivacyPrefs();
  const I = (s: Parameters<typeof PixelIcon>[0]["sprite"], size = 24) => (
    <PixelIcon sprite={s} size={size} />
  );
  // 策展层(doc 08 §1.2):访客视角下隐藏应用从开始菜单消失。菜单是纯
  // 客户端渲染(无 SSR 首帧),直接读 store 即可;主人(非预览)看全量。
  const visitor = !ownerState.token || ownerState.preview;

  const items: MenuItem[] = [
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.programs")}
          <span className="underline">(P)</span>
        </>
      ),
      icon: I(FolderIcon),
      sub: [
        {
          kind: "item",
          label: "Terminal",
          icon: I(ConsoleIcon),
          hideId: "terminal",
          action: () => api.open("terminal"),
        },
        {
          kind: "item",
          label: t("taskbar.media"),
          icon: I(MediaIcon),
          hideId: "media",
          action: () => api.open("media"),
        },
        {
          kind: "item",
          label: t("app.monitor"),
          icon: I(ChartIcon),
          hideId: "monitor",
          action: () => api.open("monitor"),
        },
        {
          kind: "item",
          label: t("app.nes.name"),
          icon: I(CartridgeIcon),
          hideId: "nes",
          action: () => api.open("nes"),
        },
        {
          kind: "item",
          label: t("app.mines"),
          icon: I(MineIcon),
          hideId: "mines",
          action: () => api.open("mines"),
        },
        {
          kind: "item",
          label: t("gamepad.test"),
          icon: I(JoystickIcon),
          action: () =>
            api.dialog(t("gamepad.title"), [
              t("gamepad.line1"),
              t("gamepad.line2"),
            ]),
        },
      ],
    },
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.documents")}
          <span className="underline">(D)</span>
        </>
      ),
      icon: I(FolderIcon),
      sub: [
        {
          kind: "item",
          label: t("portfolio.work.title"),
          icon: I(FolderIcon),
          hideId: "work",
          action: () => api.open("work"),
        },
        {
          kind: "item",
          label: t("portfolio.research.title"),
          icon: I(FolderIcon),
          hideId: "research",
          action: () => api.open("research"),
        },
        {
          kind: "item",
          label: "notes.txt",
          icon: I(TxtIcon),
          hideId: "notes",
          action: () => api.open("notes"),
        },
        {
          kind: "item",
          label: "README.TXT",
          icon: I(TxtIcon),
          hideId: "readme",
          action: () => api.open("readme"),
        },
        {
          kind: "item",
          label: t("app.stickies.name"),
          icon: I(NoteIcon),
          hideId: "stickies",
          action: () => api.open("stickies"),
        },
      ],
    },
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.settings")}
          <span className="underline">(S)</span>
        </>
      ),
      icon: I(GearIcon),
      sub: [
        {
          kind: "item",
          label: `${t("app.settings.name")}…`,
          icon: I(DisplayIcon),
          action: () => api.open("settings"),
        },
        {
          kind: "item",
          label: t("app.systemProps"),
          icon: I(GearIcon),
          action: () => api.open("sysprops"),
        },
        {
          kind: "item",
          label: `${t("app.ownerLock.name")}…`,
          icon: I(LockIcon),
          action: () => api.open("ownerlock"),
        },
      ],
    },
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.find")}
          <span className="underline">(F)</span>: {t("startMenu.findTarget")}
        </>
      ),
      icon: I(SearchIcon),
      action: () =>
        api.dialog(
          t("startMenu.findFull"),
          [t("find.line1"), t("find.line2"), t("find.line3")],
          "info"
        ),
    },
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.help")}
          <span className="underline">(H)</span>
        </>
      ),
      icon: I(HelpIcon),
      action: () => api.open("readme"),
    },
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.run")}
          <span className="underline">(R)</span>…
        </>
      ),
      icon: I(ConsoleIcon),
      action: () => api.open("run"),
    },
    { kind: "sep" },
    {
      kind: "item",
      label: (
        <>
          {t("startMenu.shutdown")}
          <span className="underline">(U)</span>…
        </>
      ),
      icon: I(PowerIcon),
      action: api.shutdown,
    },
  ];

  return (
    <nav
      className="absolute bottom-[34px] left-[2px] bg-chrome bevel-out p-[3px] flex z-[860]"
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={t("startMenu.aria")}
    >
      <div className="w-[26px] shrink-0 bg-navy relative rounded-br-[3px]">
        <span
          className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white font-display text-[22px] leading-none tracking-wide"
          style={{ writingMode: "vertical-rl", transform: "translateX(-50%) rotate(180deg)" }}
        >
          NewBoy 95
        </span>
      </div>
      <ul className="w-[220px]">
        {(visitor ? filterMenu(items, new Set(storePrivacy.hiddenApps)) : items).map((it, i) => (
          <Row key={i} item={it} onClose={onClose} />
        ))}
      </ul>
      <span className="sr-only">
        <PixelIcon sprite={LogoMark} size={1} />
      </span>
    </nav>
  );
}
