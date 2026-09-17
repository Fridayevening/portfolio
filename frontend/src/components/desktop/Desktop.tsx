"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DesktopContext, type DesktopApi, type DynamicWindowDef } from "./context";
import { MenuProvider, useContextMenu } from "./ContextMenu";
import type { MenuItem } from "./menu";
import DesktopIcon from "./DesktopIcon";
import DeskTexts from "./DeskTexts";
import StickyNote from "./StickyNote";
import StickyNotes from "./StickyNotes";
import Window95 from "./Window95";
import Taskbar, { type TaskEntry } from "./Taskbar";
import BootSequence from "./BootSequence";
import ShutdownScreen from "./ShutdownScreen";
import Ledger from "./Ledger";
import MarketAlerts from "./MarketAlerts";
import DisclaimerNote from "./DisclaimerNote";
import Paperclip from "./Paperclip";
import HotaruWindow from "./HotaruWindow";
import ImgLabWindow from "./ImgLabWindow";
import StickyManager from "./StickyManager";
import RepairGame from "./RepairGame";
import NesWindow from "./NesWindow";
import Mines, { MINES_GEOM } from "./Mines";
import PaperWindow, { PAPER_GEOM } from "./Paper";
import Settings from "./Settings";
import OwnerLock from "./OwnerLock";
import { useI18n } from "../../lib/i18n/LanguageContext";
import type { DictKey, Lang } from "../../lib/i18n/dict";
import {
  openFsChild,
  pasteFs,
  refreshFolderWindow,
  toggleSecretFs,
  trashFsDeep,
} from "./Fs";
import { RenameInput, stemEnd, useFsItemMenu } from "./fsMenu";
import {
  bumpFsRevision,
  setFsClipboard,
  useFsClipboard,
  useFsRevision,
  type FsClip,
} from "./fsState";
import { addDeskText } from "./deskTextState";
import { addStickyNote } from "./stickyState";
import {
  UI_DEFAULTS,
  prefsRestored,
  restoreUiPrefs,
  setIconPosEntry,
  setUiPrefs,
  useIconPos,
  usePrivacyPrefs,
  useUiPrefs,
} from "./prefsState";
import { EMPTY_ICON_POS, type BootPrefs } from "../../lib/prefs";
import { BinWindow } from "./Bin";
import { listFsNodes, renameFsNode } from "../../lib/api/files";
import { ApiError } from "../../lib/api/client";
import type { FsNode } from "../../lib/api/types";
import { useConnection } from "../../lib/api/mode";
import { isVisitorView, useOwnerState } from "../../lib/api/owner";
import { verifyOwner } from "../../lib/api/auth";
import {
  DialogContent,
  LabWindow,
  MediaPlayerWindow,
  MonitorWindow,
  MyComputerWindow,
  NotesWindow,
  PhotoCompareWindow,
  VideoCompareWindow,
  pickColaError,
  pickDenyLine,
  ReadmeWindow,
  RunWindow,
  SysPropsWindow,
  TerminalWindow,
  ToolsWindow,
} from "./windows";
import {
  BazingaIcon,
  BinIcon,
  BookshelfIcon,
  CameraIcon,
  CartridgeIcon,
  CheckIcon,
  ColaIcon,
  ComputerIcon,
  ConsoleIcon,
  DisplayIcon,
  FolderIcon,
  ImageToolIcon,
  LemonadeIcon,
  LockBadge,
  LockIcon,
  MailIcon,
  MediaIcon,
  MdDocIcon,
  MineIcon,
  NoteIcon,
  PixelIcon,
  PhotoIcon,
  RepairTvIcon,
  TxtIcon,
} from "./icons";
import { MeltDefs, MeltStage } from "./Melt";
import ColaRush, { type RushPhase } from "./ColaRush";
import SignalGlitch from "./SignalGlitch";
import Screenshot from "./Screenshot";
import { ResearchFolderWindow, WorkFolderWindow } from "./PortfolioWindows";

const BOOT_ENABLED = false;
const REPAIR_QUIET_MS = 10 * 60 * 1000; // how long repairing the TV mutes the interference

type WinDef = {
  title: string;
  /** When set, the title renders through i18n (static window titles only). */
  titleKey?: DictKey;
  /** Runtime windows can provide literal titles for both supported languages. */
  titleByLang?: Record<Lang, string>;
  icon: ReactNode;
  w: number;
  h: number;
  x: number;
  y: number;
  anchor?: "tr" | "br";
  /** Fixed-layout windows that must not be corner-resized (e.g. the media player).
   *  Error dialogs bypass defs entirely and simply pass no resizable. */
  noResize?: boolean;
  /** Property-sheet chrome: no min/max buttons and no resize — Win95 properties
   *  dialogs only ever carried a close button. */
  sheet?: boolean;
  render: () => ReactNode;
};

type WinState = {
  id: string;
  x: number;
  y: number;
  // Live size: taken from the def at open; after a corner-resize it lives in state
  // alongside x/y (close + reopen restores the defaults).
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  anchored: boolean;
};

type DlgState = {
  id: string;
  title: string;
  lines: string[];
  type: "error" | "info";
  z: number;
  x: number;
  y: number;
};

type TipState = {
  id: number;
  x: number;
  y: number;
  above: boolean;
  text: string;
};

const SCATTER_POS: Record<string, { x: string; y: string }> = {
  imgtool: { x: "45%", y: "50%" },
  young: { x: "29%", y: "56%" },
  aespu: { x: "63%", y: "64%" },
  lemonade: { x: "40%", y: "30%" },
  cola: { x: "34%", y: "28%" },
  repair: { x: "68%", y: "26%" },
};

function I(s: Parameters<typeof PixelIcon>[0]["sprite"], size = 14) {
  return <PixelIcon sprite={s} size={size} />;
}

function windowTitle(def: WinDef, lang: Lang, translate: (key: DictKey) => string): string {
  if (def.titleKey) return translate(def.titleKey);
  return def.titleByLang?.[lang] ?? def.title;
}

const WIN_DEFS: Record<string, WinDef> = {
  readme: {
    title: "README.TXT - 记事本",
    titleKey: "app.readme.title",
    icon: I(TxtIcon),
    w: 480,
    h: 360,
    x: 520,
    y: 70,
    render: () => <ReadmeWindow />,
  },
  media: {
    title: "媒体播放器",
    titleKey: "app.media",
    icon: I(MediaIcon),
    w: 380,
    h: 240,
    x: 640,
    y: 320,
    anchor: "tr",
    // Refuses all control, including being resized.
    noResize: true,
    render: () => <MediaPlayerWindow />,
  },
  mycomputer: {
    title: "我的电脑",
    titleKey: "app.myComputer",
    icon: I(ComputerIcon),
    w: 440,
    h: 320,
    x: 160,
    y: 80,
    render: () => <MyComputerWindow />,
  },
  tools: {
    title: "工具箱",
    titleKey: "app.tools",
    icon: I(FolderIcon),
    w: 460,
    h: 330,
    x: 240,
    y: 150,
    render: () => <ToolsWindow />,
  },
  lab: {
    title: "实验",
    titleKey: "app.lab",
    icon: I(FolderIcon),
    w: 420,
    h: 300,
    x: 320,
    y: 200,
    render: () => <LabWindow />,
  },
  work: {
    title: "Work",
    titleKey: "portfolio.work.title",
    icon: I(FolderIcon),
    w: 500,
    h: 360,
    x: 190,
    y: 110,
    render: () => <WorkFolderWindow />,
  },
  research: {
    title: "Research",
    titleKey: "portfolio.research.title",
    icon: I(FolderIcon),
    w: 500,
    h: 360,
    x: 280,
    y: 150,
    render: () => <ResearchFolderWindow />,
  },
  bin: {
    title: "回收站",
    titleKey: "app.recycleBin",
    icon: I(BinIcon),
    w: 420,
    h: 300,
    x: 380,
    y: 230,
    render: () => <BinWindow />,
  },
  notes: {
    title: "notes.txt - 记事本",
    titleKey: "app.notes.title",
    icon: I(TxtIcon),
    w: 440,
    h: 560,
    x: 300,
    y: 120,
    render: () => <NotesWindow />,
  },
  terminal: {
    title: "C:\\NewBoy",
    icon: I(ConsoleIcon),
    w: 520,
    h: 340,
    x: 420,
    y: 260,
    render: () => <TerminalWindow />,
  },
  monitor: {
    title: "系统监视器",
    titleKey: "app.monitor",
    icon: I(ComputerIcon),
    w: 300,
    h: 300,
    x: 560,
    y: 120,
    render: () => <MonitorWindow />,
  },
  hotaru: {
    title: "wonyoung.hotaru.jpg - 映像预览",
    titleKey: "app.hotaru.title",
    icon: I(PhotoIcon),
    w: 720,
    h: 480,
    x: 490,
    y: 280,
    render: () => (
      <PhotoCompareWindow
        leftSrc="/02.jpg"
        leftFile="02.jpg"
        leftLabel="wonyoung.jpg"
        rightSrc="/02.hotaru.jpg"
        rightFile="02.hotaru.jpg"
        rightLabel="wonyoung.hotaru.jpg"
        dims="3024x4032"
        caption="python hotaru.py ./img/ep/wonyoung.jpg --ghost 1.8 --glow 1 --haze 0.1 --dv --dv-shift 4 --laser 0.2 --palette omoide --tint 0.25"
      />
    ),
  },
  aespu: {
    title: "aespu.mp4 - 映像预览",
    titleKey: "app.aespu.title",
    icon: I(PhotoIcon),
    w: 620,
    h: 540,
    x: 410,
    y: 200,
    render: () => (
      <VideoCompareWindow
        leftSrc="/13.mp4"
        leftFile="13.mp4"
        leftLabel="13.mp4"
        rightSrc="/13.ningen.mp4"
        rightFile="13.ningen.mp4"
        rightLabel="13.ningen.mp4"
        dims="720x1280 / 270x480"
        caption="PRESET=ningen ./hotaru/go.sh 13.mp4"
      />
    ),
  },
  run: {
    title: "运行",
    titleKey: "app.run",
    icon: I(ConsoleIcon),
    w: 360,
    h: 170,
    x: 440,
    y: 320,
    render: () => <RunWindow />,
  },
  sysprops: {
    title: "系统属性",
    titleKey: "app.systemProps",
    icon: I(ComputerIcon),
    w: 400,
    h: 320,
    x: 500,
    y: 180,
    render: () => <SysPropsWindow />,
  },
  // The image tool itself: parameters left, darkroom right. Placement trade-off: the
  // imgtool icon sits at a percentage position (45%/50%), so static x/y can't avoid it
  // on every viewport — at 1920 wide, 70-850 fits the whole window (the icon starts at
  // 864); narrower viewports will cover the icon, matching existing windows like
  // hotaru/aespu/terminal (covered icons can be dragged away).
  imgtool: {
    title: "HypeBoyImgTool - IMGTOOL.EXE",
    icon: I(ImageToolIcon),
    w: 780,
    h: 560,
    x: 70,
    y: 160,
    render: () => <HotaruWindow />,
  },
  // The image laboratory: server-side experimental treatments. First instrument is
  // laser-card (Blender pipeline); the desktop entry is the imgtool menubar's 实验室
  // button, no desktop icon by design.
  imglab: {
    title: "图片实验室 - IMGLAB.EXE",
    titleKey: "app.imglab.title",
    icon: I(ImageToolIcon),
    w: 560,
    h: 540,
    x: 300,
    y: 120,
    render: () => <ImgLabWindow />,
  },
  // 文稿: the tabbed markdown writer behind the PAPER. Title updates in
  // place via openDef from inside PaperWindow.
  paper: {
    title: "PAPER - 文稿",
    titleKey: "app.paper.title",
    icon: I(BookshelfIcon),
    ...PAPER_GEOM,
    render: () => <PaperWindow />,
  },
  // The NES emulator keeps its console state at module scope (NesWindow), so the
  // window closing is just the TV going off — the deck stays powered on.
  nes: {
    title: "红白机 - FAMICOM.EXE",
    titleKey: "app.nes",
    icon: I(CartridgeIcon),
    w: 560,
    h: 600,
    x: 260,
    y: 90,
    render: () => <NesWindow />,
  },
  // Minesweeper: the field is fixed-size per difficulty (the game refits the
  // window itself via api.fit when the level changes), so no corner resize.
  mines: {
    title: "扫雷",
    titleKey: "app.mines",
    icon: I(MineIcon),
    ...MINES_GEOM,
    noResize: true,
    render: () => <Mines />,
  },
  // Index over the desktop's paper scraps (stickyState): search / locate / fold /
  // delete. Opens from the surface context menu, the Start menu, run and terminal.
  stickies: {
    title: "便签管理器 - STICKIES.EXE",
    titleKey: "app.stickies",
    icon: I(NoteIcon),
    w: 460,
    h: 380,
    x: 540,
    y: 140,
    render: () => <StickyManager />,
  },
  // The interface settings property sheet: CRT dressing, repair and the desktop
  // fill, previewed live on a mini tube. Sheet chrome (no min/max, no resize)
  // sets it apart from program windows, Win95 display-properties style.
  settings: {
    title: "系统设置 - SETTINGS.EXE",
    titleKey: "app.settings",
    icon: I(DisplayIcon),
    w: 404,
    h: 414,
    x: 560,
    y: 140,
    sheet: true,
    render: () => <Settings />,
  },
  // The owner lock (doc 08): password sheet opened from the tray key or the
  // privacy settings tab. Always openable — a visitor poking it just gets the
  // password prompt (rate-limited server-side), which is exactly the bit.
  ownerlock: {
    title: "主人之锁 - LOCK.EXE",
    titleKey: "app.ownerLock",
    icon: I(LockIcon),
    w: 340,
    h: 200,
    x: 580,
    y: 200,
    sheet: true,
    render: () => <OwnerLock />,
  },
};

// The provider must sit outside DesktopInner: the surface itself consumes
// useContextMenu, and it is OS-level anyway (doc 04 §4.3 — menus don't depend on
// the desktop API).
export default function Desktop({ boot }: { boot?: BootPrefs }) {
  return (
    <MenuProvider>
      <DesktopInner boot={boot} />
    </MenuProvider>
  );
}

function DesktopInner({ boot }: { boot?: BootPrefs }) {
  const { lang, t } = useI18n();
  // README is not open by default; the monitor likewise opens only on demand.
  const [wins, setWins] = useState<Record<string, WinState>>(() => ({
    media: { id: "media", x: WIN_DEFS.media.x, y: WIN_DEFS.media.y, w: WIN_DEFS.media.w, h: WIN_DEFS.media.h, z: 11, minimized: false, maximized: false, anchored: true },
  }));
  // Read-only mirror of the wins table for api.isOpen — the api memo must not
  // churn on every window move, so it reads through this latest-ref instead.
  const winsRef = useRef(wins);
  useLayoutEffect(() => {
    winsRef.current = wins;
  });
  // Runtime window defs (registered by programs themselves) beyond the static table.
  const [dynDefs, setDynDefs] = useState<Record<string, WinDef>>({});
  const defs = useMemo(() => ({ ...WIN_DEFS, ...dynDefs }), [dynDefs]);
  const [order, setOrder] = useState<string[]>(["media"]);
  // z-index counter. Never nest another setState inside a setState updater — StrictMode
  // double-invokes updaters and exposes the side effect (it once made a dialog pop
  // twice).
  const [zTop, setZTop] = useState(11);
  const [active, setActive] = useState<string | null>("media");
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  // CRT dressing, curved glass, the desktop fill and the icon layout live in
  // the prefs store (localStorage cache + server home, see prefsState). Until
  // the mount effect restores the store, the SSR-provided cookie values render
  // instead — the server rendered the same values, so hydration matches and
  // frame one already wears the user's look. Undragged icons use their default
  // grid slots and have no entry.
  const storeUi = useUiPrefs();
  const storeIconPos = useIconPos();
  const storePrivacy = usePrivacyPrefs();
  // Owner lock (doc 08 §1.3): unlocked token + visitor preview ride the owner
  // store; every server-backed surface re-reads on identity flips (the fs
  // fetch effects key off it). Dual-read boot fallback like ui/iconPos so the
  // SSR frame already hides the visitor-hidden apps.
  const ownerState = useOwnerState();
  const visitor = !ownerState.token || ownerState.preview;
  const prefs = prefsRestored() ? storeUi : (boot?.ui ?? UI_DEFAULTS);
  const iconPos = prefsRestored() ? storeIconPos : (boot?.iconPos ?? EMPTY_ICON_POS);
  const privacy = prefsRestored()
    ? storePrivacy
    : { hiddenApps: boot?.hiddenApps ?? [], defaultSecret: false };
  useEffect(() => {
    restoreUiPrefs(boot);
  }, [boot]);
  // A stored token may predate an OWNER_TOKEN rotation — verify once, silently
  // (a definitive "not owner" logs out; an unreachable server keeps the token).
  useEffect(() => {
    void verifyOwner();
  }, []);
  const crt = prefs.crt;
  const glass = prefs.glass;
  const [off, setOff] = useState(false);
  // Lemonade easter egg: the whole page melts; MeltStage then rewinds time and plays it
  // back exactly.
  const [melt, setMelt] = useState(false);
  // Cola easter egg: sugar rush → caffeine crash, sitewide animation re-rate (mutually
  // exclusive with melt: one warps space, the other time). Mounting (rushMounted) and
  // the filter class (rushPhase) must stay separate: during recovery ColaRush calls
  // onPhase(null) to drop the filter — if mounting were bound to it too, the component
  // would unmount on the spot and onDone's cleanup would never run.
  const [rushMounted, setRushMounted] = useState(false);
  const [rushPhase, setRushPhase] = useState<RushPhase | null>(null);
  // Screenshot viewfinder (doc 07): while framing, the glitch must hold its fire —
  // an episode would tear the desktop between viewfinder and rasterization.
  // shotDirect rides along: the desk's 截图 icon skips framing and fires at once.
  const [shotOpen, setShotOpen] = useState(false);
  const [shotDirect, setShotDirect] = useState(false);
  const [booted, setBooted] = useState(!BOOT_ENABLED);
  const [dialogs, setDialogs] = useState<DlgState[]>([]);
  const [tip, setTip] = useState<TipState | null>(null);
  const tipSeq = useRef(0);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Viewport size: the sticky note needs the image tool's percentage default converted
  // to pixels (once dragged, iconPos holds pixels directly); null on the SSR first
  // frame, where the note doesn't render, avoiding a hydration mismatch.
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const upd = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);

  const focus = useCallback(
    (id: string) => {
      const next = zTop + 1;
      setZTop(next);
      setWins((ws) => (ws[id] ? { ...ws, [id]: { ...ws[id], z: next } } : ws));
      setActive(id);
    },
    [zTop],
  );

  const dialog = useCallback(
    (title: string, lines: string[], type: "error" | "info" = "error") => {
      const id = `dlg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const z = zTop + 1;
      setZTop(z);
      setDialogs((ds) => [...ds, { id, title, lines, type, z, x: 560, y: 330 }]);
    },
    [zTop],
  );

  // Hidden-app gate rides open() itself (doc 08 §1.2): in the visitor's view a
  // hidden app refuses to open no matter where it's invoked from — quick
  // launch, run, terminal, start menu and openDef all funnel through here.
  const open = useCallback(
    (id: string, def?: WinDef) => {
      if (visitor && privacy.hiddenApps.includes(id)) {
        dialog("NewBoy", [t("desktop.hidden1").replace("{id}", id), t("desktop.hidden2")]);
        return;
      }
      setWins((ws) => {
        if (ws[id]) {
          return { ...ws, [id]: { ...ws[id], minimized: false } };
        }
        // A directly-passed def wins: in the same tick as openDef's setDynDefs, the
        // defs table lookup would still hit the stale closure.
        const d = def ?? defs[id];
        if (!d) return ws;
        // Windows with a default anchor get re-pinned to their corner on reopen.
        return { ...ws, [id]: { id, x: d.x, y: d.y, w: d.w, h: d.h, z: 0, minimized: false, maximized: false, anchored: !!d.anchor } };
      });
      setOrder((o) => (o.includes(id) ? o : [...o, id]));
      focus(id);
    },
    // dialog/focus are zTop-bound and visitor/hiddenApps identity-stable — the
    // memo churn here matches the pre-existing focus dep, nothing new.
    [focus, defs, dialog, visitor, privacy.hiddenApps, t],
  );

  // Dynamic open: register the def first, then call open carrying the def (bypassing
  // the same-tick stale table lookup) — if the window is already open it only refocuses
  // and swaps the render (position untouched), so a fixed id means "at most one
  // window".
  const openDef = useCallback(
    (def: DynamicWindowDef) => {
      setDynDefs((ds) => ({ ...ds, [def.id]: def }));
      open(def.id, def);
    },
    [open],
  );

  const close = useCallback((id: string) => {
    setWins((ws) => {
      const next = { ...ws };
      delete next[id];
      return next;
    });
    setOrder((o) => o.filter((x) => x !== id));
    setActive((a) => (a === id ? null : a));
  }, []);

  // Program-side resize (corner-drag's sibling): keeps the top-left corner but clamps
  // to the viewport and pulls the window back on-screen when it would overflow. A
  // maximized window keeps the stored size for its restore.
  const fit = useCallback((id: string, w: number, h: number) => {
    setWins((ws) => {
      const win = ws[id];
      if (!win) return ws;
      const nw = Math.min(Math.round(w), window.innerWidth - 24);
      const nh = Math.min(Math.round(h), window.innerHeight - 36 - 24); // 36 = taskbar
      return {
        ...ws,
        [id]: {
          ...win,
          w: nw,
          h: nh,
          x: Math.min(win.x, Math.max(0, window.innerWidth - nw - 8)),
          y: Math.min(win.y, Math.max(0, window.innerHeight - 36 - nh - 8)),
        },
      };
    });
  }, []);

  // Transient tip: pops above the anchor button and removes itself when its animation
  // finishes; this only swaps content and position.
  const showTip = useCallback((anchor: HTMLElement | null, text: string) => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const above = r.top > 64; // not enough headroom → flip below the button
    // Centered on the button horizontally but never past the viewport (half the width
    // of the longest denial line is reserved).
    const x = Math.min(Math.max(r.left + r.width / 2, 96), window.innerWidth - 96);
    tipSeq.current += 1;
    setTip({ id: tipSeq.current, x, y: above ? r.top - 6 : r.bottom + 6, above, text });
    if (tipTimer.current) clearTimeout(tipTimer.current);
    // The 1.4 s animation should be done by now; under reduced-motion the animation is
    // globally off, and this timer clears the tip regardless.
    tipTimer.current = setTimeout(() => setTip(null), 1500);
  }, []);

  useEffect(
    () => () => {
      if (tipTimer.current) clearTimeout(tipTimer.current);
    },
    [],
  );

  // Repair TV: double-click opens the whack-a-spark repair game (RepairGame). Winning
  // fires repairWon, which mutes the signal interference for REPAIR_QUIET_MS (the
  // paused flip tears down an in-flight episode on the spot); regular scheduling
  // resumes when it expires. Double-clicking during a mute just reopens the game —
  // the warranty is always earned, never given.
  const [tvRepaired, setTvRepaired] = useState(false);
  const repairTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (repairTimer.current) clearTimeout(repairTimer.current);
    },
    [],
  );
  // Deliberately dep-free: dynDefs keeps the render closure captured at openDef time,
  // so any dep (tvRepaired, or dialog's z counter) would hand RepairGame a stale onWon.
  const repairWon = useCallback(() => {
    setTvRepaired(true);
    if (repairTimer.current) clearTimeout(repairTimer.current);
    repairTimer.current = setTimeout(() => setTvRepaired(false), REPAIR_QUIET_MS);
  }, []);
  const repairTv = useCallback(() => {
    openDef({
      id: "repair",
      title: t("app.repair.title"),
      icon: I(RepairTvIcon),
      w: 400,
      h: 436,
      x: 560,
      y: 160,
      noResize: true,
      render: () => <RepairGame again={tvRepaired} onWon={repairWon} />,
    });
  }, [openDef, repairWon, tvRepaired, t]);

  // Melt finished (rewind complete): just drop the mode — the restoration is seamless.
  const finishMelt = useCallback(() => setMelt(false), []);
  // Rush finished: unmount the stage + drop the filter + sweep every error-storm
  // dialog (melt's philosophy: however it raged, it cleans up after itself).
  const finishRush = useCallback(() => {
    setRushMounted(false);
    setRushPhase(null);
    setDialogs((ds) => ds.filter((d) => !d.id.startsWith("cola-dlg-")));
  }, []);

  // Rush-phase error storm: an avalanche of classic error dialogs scattered at random,
  // out to drown the desktop. They don't join the window system's z order — fixed high
  // (above taskbar/start menu, below the scanlines), all with the cola-dlg- id prefix
  // so recovery can clear them in one batch.
  useEffect(() => {
    if (rushPhase !== "rush") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let n = 0;
    const pop = () => {
      if (!alive) return;
      const def = pickColaError();
      setDialogs((ds) => [
        ...ds,
        {
          id: `cola-dlg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: def.title,
          lines: def.lines,
          type: "error" as const,
          // Later popups cover earlier ones; capped at 896 to stay under the 900
          // scanlines — on equal z, DOM order still puts the later one on top.
          z: Math.min(896, 866 + n),
          x: 30 + Math.random() * Math.max(60, window.innerWidth - 420),
          y: 30 + Math.random() * Math.max(60, window.innerHeight - 260),
        },
      ]);
      n += 1;
      // Shrinking interval: starts at 700 ms, accelerates 90 ms per popup, floor
      // 130 ms — ~44 dialogs over the 8 s rush.
      timer = setTimeout(pop, Math.max(130, 700 - n * 90));
    };
    timer = setTimeout(pop, 300); // the avalanche starts almost immediately
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [rushPhase]);

  const api = useMemo<DesktopApi>(
    () => ({
      open,
      close,
      isOpen: (id: string) => !!winsRef.current[id],
      openDef,
      fit,
      dialog,
      tip: showTip,
      shutdown: () => setOff(true),
      glass,
      toggleGlass: () => setUiPrefs({ glass: !prefs.glass }),
      crt,
      toggleCrt: () => setUiPrefs({ crt: !prefs.crt }),
      repair: repairTv,
      desktopColor: prefs.desktopColor,
      setDesktopColor: (hex: string) => setUiPrefs({ desktopColor: hex }),
    }),
    [open, close, openDef, fit, dialog, showTip, repairTv, prefs, crt, glass],
  );

  // Minimize hides without unmounting (Window95 applies display:none), so program
  // state survives the round trip. Activation passes to the top-most remaining
  // visible window, Win95-style — no z raise, it is already above the others.
  const minimize = useCallback((id: string) => {
    const heir = Object.values(winsRef.current)
      .filter((w) => w.id !== id && !w.minimized)
      .reduce<WinState | null>((top, w) => (!top || w.z > top.z ? w : top), null);
    setWins((ws) =>
      ws[id] && !ws[id].minimized ? { ...ws, [id]: { ...ws[id], minimized: true } } : ws,
    );
    setActive((a) => (a === id ? heir?.id ?? null : a));
  }, []);

  // Taskbar click: the active window minimizes; anything else restores/raises —
  // open() already un-minimizes an existing window and refocuses it.
  const toggleWin = useCallback(
    (id: string) => {
      if (active === id) minimize(id);
      else open(id);
    },
    [active, minimize, open],
  );

  const toggleMax = useCallback((id: string) => {
    setWins((ws) => (ws[id] ? { ...ws, [id]: { ...ws[id], maximized: !ws[id].maximized } } : ws));
  }, []);

  const move = useCallback((id: string, x: number, y: number) => {
    setWins((ws) => (ws[id] ? { ...ws, [id]: { ...ws[id], x, y, anchored: false } } : ws));
  }, []);

  // Corner resize: the handle reports full geometry from the measured rect; anchoring
  // is released along the way (same treatment as a titlebar drag).
  const resize = useCallback((id: string, x: number, y: number, w: number, h: number) => {
    setWins((ws) => (ws[id] ? { ...ws, [id]: { ...ws[id], x, y, w, h, anchored: false } } : ws));
  }, []);

  // Desktop icon drag: clamped into the viewport, never over the taskbar (the
  // same clamp runs at prefs restore, see prefsState).
  const moveIcon = useCallback((id: string, x: number, y: number) => {
    setIconPosEntry(id, {
      x: Math.min(Math.max(x, 0), window.innerWidth - 86),
      y: Math.min(Math.max(y, 0), window.innerHeight - 36 - 70), // 36 = taskbar, 70 = icon footprint (×1.2)
    });
  }, []);

  // ── Desktop filesystem: server-backed nodes created through folder windows'
  // context menus. They share the icon grid (fs- prefix keeps them off the
  // static ids). Every mutation bumps the revision store; the effect below (and
  // every open folder window / the bin) refetches off it — no per-callsite
  // refresh bookkeeping.
  const menu = useContextMenu();
  const conn = useConnection();
  const clip = useFsClipboard();
  const revision = useFsRevision();
  const [fsNodes, setFsNodes] = useState<FsNode[] | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  useEffect(() => {
    if (conn.status !== "live") return;
    let alive = true;
    listFsNodes()
      .then((ns) => alive && setFsNodes(ns))
      .catch(() => {
        // Keep whatever list we had; the menu items go disabled via conn anyway.
      });
    return () => {
      alive = false;
    };
    // ownerState dep: identity flips (unlock/lock/preview) refetch under the
    // new viewer — the server decides visibility, this just re-asks.
  }, [conn.status, revision, ownerState]);

  // Where the surface right-click happened, so 新建便签 spawns under the cursor.
  const ctxAt = useRef({ x: 0, y: 0 });

  const doRename = useCallback(
    async (n: FsNode, raw: string) => {
      setRenameId(null);
      const name = raw.trim().slice(0, 100);
      if (!name || name === n.name) return;
      try {
        const updated = await renameFsNode(n.id, name);
        // A renamed folder may have its window open: swap the def so the titlebar
        // and taskbar follow (openDef reuse keeps position).
        if (n.type === "folder") refreshFolderWindow(api, updated);
        bumpFsRevision();
      } catch (e) {
        // The refetch restores the old label; the dialog explains why.
        bumpFsRevision();
        dialog(
          t("fs.rename"),
          e instanceof ApiError && e.status === 400
            ? [t("fs.dup"), t("fs.dupHint")]
            : [t("fs.renameFail"), t("fs.connectLater")],
        );
      }
    },
    [api, dialog, t],
  );

  const beginRenameFs = useCallback((n: FsNode) => {
    setSelectedIcon(`fs-${n.id}`);
    setRenameId(n.id);
    setRenameVal(n.name);
  }, []);

  const { openItemMenu } = useFsItemMenu(
    {
      live: () => conn.status === "live",
      isOwner: () => !isVisitorView(),
      openNode: (n) => openFsChild(api, n),
      beginRename: beginRenameFs,
      trashNode: (n) => void trashFsDeep(api, n.id),
      cutNode: (n) => setFsClipboard({ mode: "cut", id: n.id }),
      copyNode: (n) => setFsClipboard({ mode: "copy", id: n.id }),
      // toggleSecretFs shared with folder windows (Fs.tsx)
      toggleSecret: (n) => void toggleSecretFs(api, n),
    },
    (n) => setSelectedIcon(`fs-${n.id}`),
  );

  // Menu items are evaluated per render while open; read live state through the
  // ref, never the open-time closure (doc 04 铁律 4).
  const menuLive = useRef({
    live: false,
    paste: () => {},
    clip: null as FsClip | null,
    openStickies: () => {},
    openSettings: () => {},
    crt: false,
    toggleCrt: () => {},
    shotReady: false,
    openShot: () => {},
  });
  useLayoutEffect(() => {
    menuLive.current = {
      live: conn.status === "live",
      paste: () => void pasteFs(api, null),
      clip,
      openStickies: () => open("stickies"),
      openSettings: () => open("settings"),
      crt,
      toggleCrt: () => setUiPrefs({ crt: !prefs.crt }),
      // The viewfinder shoots the desktop as-seen; during melt/rush the screen is
      // mid-transformation and the shot would be a lie (doc 07 §3.5).
      shotReady: !melt && !rushMounted,
      openShot: () => {
        setShotDirect(false);
        setShotOpen(true);
      },
    };
  });
  const desktopMenu = useCallback((): MenuItem[] => {
    const { live, paste, clip, openStickies, openSettings, crt, toggleCrt, shotReady, openShot } = menuLive.current;
    return [
      { kind: "item", label: t("ctx.newSticky"), icon: I(NoteIcon), action: () => addStickyNote(ctxAt.current.x, ctxAt.current.y, t("sticky.default")) },
      { kind: "item", label: t("ctx.stickyManager"), icon: I(NoteIcon), action: () => openStickies() },
      { kind: "item", label: t("ctx.addText"), icon: I(TxtIcon), action: () => addDeskText(ctxAt.current.x, ctxAt.current.y) },
      { kind: "item", label: t("ctx.screenshot"), icon: I(CameraIcon), disabled: !shotReady, action: () => openShot() },
      { kind: "sep" },
      // 剪切/复制 need a selection, which the bare surface never has (doc 04 §5);
      // paste is the only clipboard verb the desktop blank offers.
      { kind: "item", label: t("ctx.cut"), disabled: true },
      { kind: "item", label: t("ctx.copy"), disabled: true },
      { kind: "item", label: t("ctx.paste"), hint: "Ctrl+V", disabled: !(live && clip), action: () => paste() },
      { kind: "sep" },
      { kind: "item", label: t("ctx.settings"), icon: I(DisplayIcon), action: () => openSettings() },
      { kind: "item", label: t("ctx.crt"), icon: crt ? I(CheckIcon) : undefined, hint: crt ? t("ctx.on") : t("ctx.off"), action: () => toggleCrt() },
    ];
  }, [t]);

  const fsIcons = useMemo(
    () =>
      (fsNodes ?? []).map((n) => ({
        id: `fs-${n.id}`,
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
        icon: (
          <span className="relative inline-flex">
            <PixelIcon
              sprite={n.type === "folder" ? FolderIcon : n.type === "doc" ? MdDocIcon : PhotoIcon}
              size={40}
            />
            {n.secret === true && <LockBadge />}
          </span>
        ),
        onOpen: () => openFsChild(api, n),
        onContextMenu: (e: Parameters<typeof openItemMenu>[0]) => openItemMenu(e, n),
        dimmed: clip?.mode === "cut" && clip.id === n.id,
        onRenameKey: () => beginRenameFs(n),
      })),
    [fsNodes, api, renameId, renameVal, clip, openItemMenu, doRename, beginRenameFs],
  );

  const desktopIcons = useMemo<
    {
      id: string;
      label: ReactNode;
      icon: ReactNode;
      onOpen: () => void;
      onContextMenu?: (e: Parameters<typeof openItemMenu>[0]) => void;
      dimmed?: boolean;
      onRenameKey?: () => void;
    }[]
  >(() => [
    { id: "mycomputer", label: t("app.myComputer"), icon: <PixelIcon sprite={ComputerIcon} size={40} />, onOpen: () => open("mycomputer") },
    { id: "tools", label: t("app.tools"), icon: <PixelIcon sprite={FolderIcon} size={40} />, onOpen: () => open("tools") },
    { id: "lab", label: t("app.lab"), icon: <PixelIcon sprite={FolderIcon} size={40} />, onOpen: () => open("lab") },
    { id: "work", label: t("portfolio.work.title"), icon: <PixelIcon sprite={FolderIcon} size={40} />, onOpen: () => open("work") },
    { id: "research", label: t("portfolio.research.title"), icon: <PixelIcon sprite={FolderIcon} size={40} />, onOpen: () => open("research") },
    { id: "notes", label: "notes.txt", icon: <PixelIcon sprite={TxtIcon} size={40} />, onOpen: () => open("notes") },
    { id: "media", label: t("app.media"), icon: <PixelIcon sprite={MediaIcon} size={40} />, onOpen: () => open("media") },
    { id: "readme", label: "README.TXT", icon: <PixelIcon sprite={TxtIcon} size={40} />, onOpen: () => open("readme") },
    { id: "terminal", label: "NewBoy.lnk", icon: <PixelIcon sprite={ConsoleIcon} size={40} />, onOpen: () => open("terminal") },
    {
      id: "mail",
      label: "MAIL",
      icon: <PixelIcon sprite={MailIcon} size={40} />,
      onOpen: () =>
        dialog(t("mail.title"), [
          t("mail.line1"),
          t("mail.line2"),
        ]),
    },
    { id: "bin", label: t("app.recycleBin"), icon: <PixelIcon sprite={BinIcon} size={40} />, onOpen: () => open("bin") },
    // Bookshelf opens 文稿 (the markdown writer); Bazinga is still a placeholder note.
    {
      id: "paper",
      label: "PAPER",
      icon: <PixelIcon sprite={BookshelfIcon} size={40} />,
      onOpen: () => open("paper"),
    },
    {
      id: "bazinga",
      label: "Bazinga",
      icon: <PixelIcon sprite={BazingaIcon} size={40} />,
      onOpen: () =>
        dialog("Bazinga", [t("bazinga.line1"), t("bazinga.line2")], "info"),
    },
    // The main-stage tool: the image tool owns desktop center and, like the photo
    // pair, sits after the grid icons — once scattered it takes no grid slot, leaving
    // an empty slot at the tail rather than a mid-column hole.
    {
      id: "imgtool",
      label: "HypeBoyImgTool",
      icon: <PixelIcon sprite={ImageToolIcon} size={40} />,
      onOpen: () => open("imgtool"),
    },
    // The photo pair occupies two grid indices at the tail; real placement goes through
    // SCATTER_POS, leaving no holes in the grid.
    { id: "aespu", label: "aespu.mp4", icon: <PixelIcon sprite={PhotoIcon} size={40} />, onOpen: () => open("aespu") },
    { id: "young", label: "young.jpg", icon: <PixelIcon sprite={PhotoIcon} size={40} />, onOpen: () => open("hotaru") },
    // Repair TV: the earned mute switch for the ambient "signal interference" —
    // double-click opens the whack-a-spark repair game; scattered in the central
    // band (SCATTER_POS).
    {
      id: "repair",
      label: t("app.repair"),
      icon: <PixelIcon sprite={RepairTvIcon} size={40} />,
      onOpen: repairTv,
    },
    { id: "nes", label: t("app.nes.name"), icon: <PixelIcon sprite={CartridgeIcon} size={40} />, onOpen: () => open("nes") },
    // Direct shutter: the raster shoots .crt-screen, so whatever is on the desk
    // — viewer windows included — lands in the PNG. The same honesty gate as the
    // menu's 截图 (no shooting mid-melt/mid-rush).
    {
      id: "snapshot",
      label: t("app.screenshot"),
      icon: <PixelIcon sprite={CameraIcon} size={40} />,
      onOpen: () => {
        if (melt || rushMounted) return;
        setShotDirect(true);
        setShotOpen(true);
      },
    },
    ...fsIcons,
  ].filter((it) => {
    // 策展层(doc 08 §1.2):访客视角下按 hiddenApps 整窗隐藏;主人(非预览)
    // 永远看全。fs-* 图标不进这层 —— 内容隐私由服务端说了算。
    if (!visitor) return true;
    return !privacy.hiddenApps.includes(it.id);
  }), [open, dialog, repairTv, fsIcons, visitor, privacy.hiddenApps, melt, rushMounted, t]);

  const entries: TaskEntry[] = order
    .filter((id) => wins[id])
    .map((id) => ({
      id,
      title: windowTitle(defs[id], lang, t),
      icon: defs[id].icon,
      active: active === id,
    }));

  if (!booted) {
    return <BootSequence onDone={() => setBooted(true)} />;
  }

  return (
    <DesktopContext.Provider value={api}>
      <div
        className={`fixed inset-0 overflow-hidden bg-black ${glass && crt ? "crt-glass" : ""}`}
        style={{ "--desktop": prefs.desktopColor } as CSSProperties}
      >
        <div
          className={`crt-screen ${crt ? "crt-flicker" : ""} absolute inset-0 bg-desktop select-none overflow-hidden ${melt ? "mode-melt" : ""} ${
            rushPhase === "rush" ? "mode-rush" : rushPhase === "crash" ? "mode-crash" : ""
          }`}
          onPointerDown={() => {
            setStartOpen(false);
            setSelectedIcon(null);
          }}
          onContextMenu={(e) => {
            // Only the bare surface: icons, windows and the taskbar are children
            // whose right-clicks bubble here — those stay suppressed (the menu
            // for icons arrives with the clipboard phase).
            if (e.target !== e.currentTarget) return;
            ctxAt.current = { x: e.clientX, y: e.clientY };
            menu.open(e, desktopMenu);
          }}
        >
          {/* Desktop icons: absolutely positioned, draggable anywhere; undragged ones
              fall back to default slots — most flow into the top-left grid (7 per
              column, leaving the bottom corners to the market-alerts toast and the
              newspaper card), while the scattered pair (young/aespu) uses
              SCATTER_POS percentages. */}
          {desktopIcons.map((it, i) => {
            const p = iconPos[it.id] ?? SCATTER_POS[it.id] ?? {
              x: 8 + Math.floor(i / 7) * 108,
              y: 8 + (i % 7) * 84,
            };
            return (
              <DesktopIcon
                key={it.id}
                label={it.label}
                icon={it.icon}
                selected={selectedIcon === it.id}
                dimmed={it.dimmed}
                x={p.x}
                y={p.y}
                onSelect={() => setSelectedIcon(it.id)}
                onOpen={it.onOpen}
                onMove={(mx, my) => moveIcon(it.id, mx, my)}
                onContextMenu={it.onContextMenu}
                onRenameKey={it.onRenameKey}
              />
            );
          })}

          {/* Main-stage sticky note: follows the image tool, arrow always pointing at
              it; flips to the right side when the left edge can't fit it. */}
          {vp &&
            (() => {
              const p =
                iconPos.imgtool ??
                ({
                  x: (vp.w * parseFloat(SCATTER_POS.imgtool.x)) / 100,
                  y: (vp.h * parseFloat(SCATTER_POS.imgtool.y)) / 100,
                } as const);
              return <StickyNote x={p.x} y={p.y} vw={vp.w} vh={vp.h} />;
            })()}

          {/* The easter-egg pair: selectable/draggable like normal icons, but scattered
              onto the desktop's corners by default (not the central grid). Lemonade =
              whole-page melt; cola = sugar rush → caffeine crash (sitewide animation
              re-rate). The two are mutually exclusive: one warps space, the other time
              — together they'd fight. */}
          <DesktopIcon
            label="Lemonade"
            icon={<PixelIcon sprite={LemonadeIcon} size={40} />}
            selected={selectedIcon === "lemonade"}
            x={iconPos.lemonade?.x ?? SCATTER_POS.lemonade.x}
            y={iconPos.lemonade?.y ?? SCATTER_POS.lemonade.y}
            onSelect={() => setSelectedIcon("lemonade")}
            onOpen={() => {
              if (!melt && !rushMounted) setMelt(true);
            }}
            onMove={(mx, my) => moveIcon("lemonade", mx, my)}
          />
          <DesktopIcon
            label="Coca~Cola"
            icon={<PixelIcon sprite={ColaIcon} size={40} />}
            selected={selectedIcon === "cola"}
            x={iconPos.cola?.x ?? SCATTER_POS.cola.x}
            y={iconPos.cola?.y ?? SCATTER_POS.cola.y}
            onSelect={() => setSelectedIcon("cola")}
            onOpen={() => {
              if (!melt && !rushMounted) {
                setRushMounted(true);
                setRushPhase("rush");
              }
            }}
            onMove={(mx, my) => moveIcon("cola", mx, my)}
          />

          <Ledger />
          <MarketAlerts />
          <DisclaimerNote />

          {/* User sticky notes: paper scraps spawned from the surface menu, kept
              below the window system like the rest of the desk surface. */}
          <StickyNotes />

          {/* Bare desk texts: same scraps minus the paper — words written
              straight onto the surface. */}
          <DeskTexts />

          {/* Minimized windows stay in the list (Window95 hides them with
              display:none) — unmounting would destroy the programs' state; only
              close removes a window. */}
          {Object.values(wins).map((w) => {
              const def = defs[w.id];
              // Media player: the titlebar has only a close button — and closing is
              // refused too.
              const pinned = w.id === "media";
              // Property sheets (settings): same treatment, minus the refusal.
              const sheet = !!def.sheet;
              return (
                <Window95
                  key={w.id}
                  title={windowTitle(def, lang, t)}
                  icon={def.icon}
                  x={w.x}
                  y={w.y}
                  w={w.w}
                  h={w.h}
                  z={w.z}
                  active={active === w.id}
                  maximized={w.maximized}
                  minimized={w.minimized}
                  anchor={w.anchored ? def.anchor : undefined}
                  canMinimize={!pinned && !sheet}
                  canMaximize={!pinned && !sheet}
                  resizable={!def.noResize && !sheet}
                  onFocus={() => focus(w.id)}
                  onClose={
                    pinned
                      ? (btn) => showTip(btn, pickDenyLine())
                      : () => close(w.id)
                  }
                  onMinimize={() => minimize(w.id)}
                  onToggleMaximize={() => toggleMax(w.id)}
                  onMove={(x, y) => move(w.id, x, y)}
                  onResize={(nx, ny, nw, nh) => resize(w.id, nx, ny, nw, nh)}
                >
                  {def.render()}
                </Window95>
              );
            })}

          {/* Dialogs (regular popups center by default; the error storm scatters them). */}
          {dialogs.map((d) => (
            <Window95
              key={d.id}
              title={d.title}
              icon={I(d.type === "error" ? ConsoleIcon : TxtIcon)}
              x={d.x}
              y={d.y}
              w={360}
              h={180}
              z={d.z}
              active={true}
              maximized={false}
              minimized={false}
              resizable={false}
              onFocus={() => {}}
              onClose={() => setDialogs((ds) => ds.filter((x) => x.id !== d.id))}
              onMinimize={() => {}}
              onToggleMaximize={() => {}}
              onMove={() => {}}
              onResize={() => {}}
            >
              <DialogContent lines={d.lines} type={d.type} />
              <div className="flex justify-center pb-3">
                <button
                  type="button"
                  className="bevel-thin-out bg-chrome px-8 py-[3px] text-[12px] press"
                  onClick={() => setDialogs((ds) => ds.filter((x) => x.id !== d.id))}
                >
                  {t("dialog.ok")}
                </button>
              </div>
            </Window95>
          ))}

          {tip && (
            <div
              key={tip.id}
              className={`player-tip ${tip.above ? "tip-above" : "tip-below"}`}
              style={{ left: tip.x, top: tip.y }}
            >
              {tip.text}
            </div>
          )}

          <Taskbar
            entries={entries}
            onToggle={toggleWin}
            startOpen={startOpen}
            setStartOpen={setStartOpen}
          />

          <Paperclip melt={melt} />
        </div>

        {crt && <div className="scanlines" aria-hidden />}
        {crt && <div className="vignette" aria-hidden />}

        <SignalGlitch paused={melt || rushMounted || off || tvRepaired || shotOpen} />

        {/* Screenshot viewfinder: portals itself to body (doc 07 §4.3) — mounting it
            here just ties its lifetime to the desktop's. The desk icon passes
            direct, skipping framing for an immediate fullscreen shot. */}
        {shotOpen && <Screenshot direct={shotDirect} onClose={() => setShotOpen(false)} />}

        {/* Melt easter egg's filter defs + stage (drips/puddle/HUD), mounted outside
            the melted subtree. */}
        <MeltDefs />
        {melt && <MeltStage onDone={finishMelt} />}

        {rushMounted && <ColaRush onPhase={setRushPhase} onDone={finishRush} />}

        {off && <ShutdownScreen onRestart={() => setOff(false)} />}
      </div>
    </DesktopContext.Provider>
  );
}
