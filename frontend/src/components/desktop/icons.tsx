"use client";

// Original Win95-style pixel icon set: character grids → crispEdges SVG.
// Palette: . transparent | k black | w white | n bright silver | s silver | g gray
//          | d dark gray | t teal (desktop) | G phosphor green | y folder yellow
//          | o yellow shade | b navy | B bright blue | r red | m dark red
//          | p paper beige (sticky note)

const PAL: Record<string, string> = {
  k: "#0a0a0a",
  w: "#ffffff",
  n: "#dfdfdf",
  s: "#c0c0c0",
  g: "#808080",
  d: "#404040",
  t: "#008080",
  G: "#33ff66",
  y: "#fce97c",
  o: "#d8a837",
  b: "#000080",
  B: "#1084d0",
  r: "#ff0000",
  m: "#800000",
  p: "#f4f1e4",
};

export type Sprite = { rows: string[]; title: string; titleKey?: import("../../lib/i18n/dict").DictKey };

import { useI18n } from "../../lib/i18n/LanguageContext";

export function PixelIcon({
  sprite,
  size = 32,
  className,
}: {
  sprite: Sprite;
  size?: number;
  className?: string;
}) {
  const { t } = useI18n();
  const w = Math.max(...sprite.rows.map((r) => r.length));
  const h = sprite.rows.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={sprite.titleKey ? t(sprite.titleKey) : sprite.title}
    >
      {sprite.rows.map((row, y) =>
        row.split("").map((ch, x) =>
          ch === "." || ch === " " ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1.02}
              height={1.02}
              fill={PAL[ch] ?? "#ff00ff"}
            />
          ),
        ),
      )}
    </svg>
  );
}

// NewBoy logo: CRT monitor + phosphor-green play button.
export const LogoMark: Sprite = {
  title: "NewBoy",
  rows: [
    "..kkkkkkkkkkkk..",
    ".kssssssssssssk.",
    ".kskkkkkkkkkksk.",
    ".kskttttttttksk.",
    ".kskttGGttttksk.",
    ".kskttGGGtttksk.",
    ".kskttGGGGttksk.",
    ".kskttGGGtttksk.",
    ".kskttGGttttksk.",
    ".kskttttttttksk.",
    ".kssssssssssssk.",
    ".kssssssssssssk.",
    ".kkkkkkkkkkkkkk.",
    "....kkkkkkkk....",
    "....ksssssk.....",
    "....kkkkkkk.....",
  ],
};

export const ComputerIcon: Sprite = {
  title: "电脑",
  titleKey: "icon.computer",
  rows: [
    "................",
    ".kkkkkkkkkkkkk..",
    ".kwwwwwwwwwwgk..",
    ".kwttttttttwgk..",
    ".kwtGGtttttwgk..",
    ".kwtGGGttttwgk..",
    ".kwtGGGGtttwgk..",
    ".kwtGGGttttwgk..",
    ".kwtGGtttttwgk..",
    ".kwttttttttwgk..",
    ".kwwwwwwwwwwgk..",
    ".kssssssssssdk..",
    ".kkkkkkkkkkkkk..",
    "....kkkkkkk.....",
    ".kkssssssssskk..",
    "..kkkkkkkkkkk...",
  ],
};

export const FolderIcon: Sprite = {
  title: "文件夹",
  titleKey: "icon.folder",
  rows: [
    "................",
    "................",
    "..kkkkkk........",
    ".kyyyyyyk.......",
    ".kyyyyyyyykkkkk.",
    ".kyyyyyyyyyyyyk.",
    ".kwwwwwwwwwwwwk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kooooooooooook.",
    ".kkkkkkkkkkkkkk.",
    "................",
  ],
};

export const TxtIcon: Sprite = {
  title: "文本文件",
  titleKey: "icon.txt",
  rows: [
    "...kkkkkkkkkk...",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwwwwwwwwwwk..",
    "..kkkkkkkkkkkk..",
  ],
};

// 稿纸文档:白纸 + 红色顶线(笔记本装订线) + 长短不齐的墨线(写了字的一页)
export const MdDocIcon: Sprite = {
  title: "稿纸文档",
  titleKey: "icon.doc",
  rows: [
    "...kkkkkkkkkk...",
    "..kwwwwwwwwwwk..",
    "..kwrrrrrrrrwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkwwwwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkkkkwk..",
    "..kwwwwwwwwwwk..",
    "..kwkkkkkwwwwk..",
    "..kkkkkkkkkkkk..",
  ],
};

// Sticky note: paper-beige scrap with ink lines and a curled bottom-right corner
// (the DisclaimerNote look, shrunk to 16×12).
export const NoteIcon: Sprite = {
  title: "便签",
  titleKey: "icon.note",
  rows: [
    "...kkkkkkkkkk...",
    "..kppppppppppk..",
    "..kpkkkkkppppk..",
    "..kppppppppppk..",
    "..kppkkkkppppk..",
    "..kppppppppppk..",
    "..kpppkkkppppk..",
    "..kppppppppppk..",
    "..kpppppppppgk..",
    "..kppppppppggk..",
    "..kpppppppgggk..",
    "...kkkkkkkkkk...",
  ],
};

export const MediaIcon: Sprite = {
  title: "媒体播放器",
  titleKey: "app.media",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kbbbbbbbbbbbgk.",
    ".kssssssssssssk.",
    ".kskkkkkkkkkksk.",
    ".kskkkGGkkkkksk.",
    ".kskkGGGGkkkksk.",
    ".kskGGGGGGkkksk.",
    ".kskkkkkkkkkksk.",
    ".kskkkkGGkkkksk.",
    ".kssssssssssssk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

export const PhoneIcon: Sprite = {
  title: "电话",
  titleKey: "icon.phone",
  rows: [
    "................",
    "..kkkkkkkkkkkk..",
    ".kddddddddddddk.",
    ".kddddddddddddk.",
    ".kkkkkkkkkkkkkk.",
    "....kkkkkkkk....",
    "...kssssssssk...",
    "...ksgsgsgsgk...",
    "...kssssssssk...",
    "...ksgsgsgsgk...",
    "...kssssssssk...",
    "...kkkkkkkkkk...",
    "................",
  ],
};

export const ConsoleIcon: Sprite = {
  title: "终端",
  titleKey: "app.terminalName",
  rows: [
    ".kkkkkkkkkkkkk..",
    ".kssssssssssdk..",
    ".kskkkkkkkkksk..",
    ".kskGkkkkkkskk..",
    ".kskGkkkkkksk...",
    ".kskGGGGGkkksk..",
    ".kskkkkkkkksk...",
    ".kskkkkkkkkksk..",
    ".kssssssssssdk..",
    ".kkkkkkkkkkkkk..",
  ],
};

export const FloppyIcon: Sprite = {
  title: "软盘",
  titleKey: "icon.floppy",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbwwwwwwbbbbk.",
    ".kbbwkkkkwbbbbk.",
    ".kbbwwwwwwbbbbk.",
    ".kbbbbbbbbbbbbk.",
    ".kbwwwwwwwwwwbk.",
    ".kbwwwwwwwwwwbk.",
    ".kbwkkkkkkkkwbk.",
    ".kbwwwwwwwwwwbk.",
    ".kbwkkkkkkwwwbk.",
    ".kbwwwwwwwwwwbk.",
    ".kbwkkkkkkkkwbk.",
    ".kbwwwwwwwwwwbk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

export const MailIcon: Sprite = {
  title: "邮件",
  titleKey: "icon.mail",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kwwwwwwwwwwwwk.",
    ".kwkwwwwwwwwkwk.",
    ".kwwkwwwwwwkwwk.",
    ".kwwwkwwwwkwwwk.",
    ".kwwwwkkkkwwwwk.",
    ".kwwwwwwwwwwwwk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

export const ChartIcon: Sprite = {
  title: "图表",
  titleKey: "icon.chart",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kssssssssssssk.",
    ".kskwwwwwwwwksk.",
    ".kskwwwwwwGGksk.",
    ".kskwwwwwGGwwks.",
    ".kskwwwwGGwwks..",
    ".kskwGGwGGwwwks.",
    ".kskwGGwwwGwwks.",
    ".kskGGwwwwGwwks.",
    ".kskwwwwwwwwksk.",
    ".kssssssssssssk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

export const JoystickIcon: Sprite = {
  title: "游戏手柄",
  titleKey: "icon.gamepad",
  rows: [
    "......rr........",
    ".....rrrr.......",
    "......kk........",
    "......kk........",
    "......kk........",
    "..kkkkkkkkkkkk..",
    ".kssssssssssssk.",
    ".kskkkkkkkkkksk.",
    ".kssssssssssssk.",
    ".kkkkkkkkkkkkkk.",
    "................",
  ],
};

export const HelpIcon: Sprite = {
  title: "帮助",
  titleKey: "icon.help",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kbbbbbbbbbbbbk.",
    ".kbbwwwwwwwwbbk.",
    ".kbbwkkwwkkwbbk.",
    ".kbwwkwwkwwkwbk.",
    ".kbwwwwwwwwwwbk.",
    ".kbwwwwkkwwwwbk.",
    ".kbwwwwkkwwwwbk.",
    ".kbwwwwwwwwwwbk.",
    ".kbwwwwkkwwwwbk.",
    ".kbbwwwwwwwwbbk.",
    ".kbbbbbbbbbbbbk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

export const GearIcon: Sprite = {
  title: "设置",
  titleKey: "icon.settings",
  rows: [
    "....kkkkkk......",
    "..kksssssskk....",
    ".kkssssssskk....",
    ".ksssssssssk....",
    "kkssskwwksssk...",
    "ksssskwwkssssk..",
    "ksssskwwkssssk..",
    "kkssskwwksssk...",
    ".ksssssssssk....",
    ".kkssssssskk....",
    "..kksssssskk....",
    "....kkkkkk......",
  ],
};

// Display properties: CRT monitor with twin chin knobs — the settings face of the
// same tube LogoMark shows from the front.
export const DisplayIcon: Sprite = {
  title: "显示设置",
  titleKey: "icon.display",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kssssssssssssk.",
    ".kskkkkkkkkkksk.",
    ".kskttttttttksk.",
    ".kskttGGttttksk.",
    ".ksktGGGGtttksk.",
    ".ksktGGGGGttksk.",
    ".kskttGGGGttksk.",
    ".ksktttGGtttksk.",
    ".kskttttttttksk.",
    ".kssssssssssssk.",
    ".ksggssssssggsk.",
    ".kkkkkkkkkkkkkk.",
    "....kkkkkkkk....",
    "...kksssssssk...",
    "..kkkkkkkkkkkk..",
  ],
};

export const SearchIcon: Sprite = {
  title: "搜索",
  titleKey: "icon.search",
  rows: [
    "...kkkkkk.......",
    "..kwwwwwwk......",
    ".kwkkkkkkwk.....",
    ".kwkwwwwkwkk....",
    ".kwkwwwwkwkk....",
    ".kwkwwwwkkkk....",
    ".kwkkkkkkddk....",
    "..kwwwwwkddk....",
    "...kkkkkkkk.....",
    ".........kk.....",
  ],
};

export const BinIcon: Sprite = {
  title: "回收站",
  titleKey: "app.recycleBin",
  rows: [
    "....ww..ww......",
    "....wwwwww......",
    ".....kkkk.......",
    "....kssssk......",
    "...kssssssk.....",
    "...kskssksk.....",
    "...kskssksk.....",
    "...kskssksk.....",
    "...kskssksk.....",
    "...kskssksk.....",
    "....kssssk......",
    ".....kkkk.......",
  ],
};

export const PowerIcon: Sprite = {
  title: "关机",
  titleKey: "icon.power",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kssssssssssssk.",
    ".kskkkkkkkkkksk.",
    ".kskwwrrrrwwksk.",
    ".kskwrrrrrrwksk.",
    ".kskwrwrrwrwksk.",
    ".kskwrwrrwrwksk.",
    ".kskwrrwwrrwksk.",
    ".kskwrwrrwrwksk.",
    ".kskkrrwwrrkksk.",
    ".kssssssssssssk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

// Image file: white sheet + landscape photo (blue sky / sun / green hills), a nod to
// Kodak Imaging's file icon.
export const PhotoIcon: Sprite = {
  title: "图片文件",
  titleKey: "icon.photo",
  rows: [
    "...kkkkkkkkkk...",
    "..kwwwwwwwwwwk..",
    "..kwBBBBBBBBwk..",
    "..kwBByyBBBBwk..",
    "..kwBBBBBBBBwk..",
    "..kwBBGGBBGGwk..",
    "..kwBGGGGGGGwk..",
    "..kwGGGGGGGGwk..",
    "..kwwwwwwwwwwk..",
    "..kkkkkkkkkkkk..",
  ],
};

// Image tool: one photo's before/after — left half the original (blue sky / sun /
// green hills), right half the same scene halftoned (sky turned to halftone teal,
// hills dithered in G/d), a split line down the middle.
export const ImageToolIcon: Sprite = {
  title: "HypeBoyImgTool",
  rows: [
    ".kkkkkkkkkkkkkk.",
    ".kwwwwwwwwwwwwk.",
    ".kwBBByBkwBwBwk.",
    ".kwBByyBkBwBwwk.",
    ".kwBBBBBkwBwBwk.",
    ".kwBBBBBkBwBwwk.",
    ".kwBBBBBkGdGdwk.",
    ".kwBGGGBkdGdGwk.",
    ".kwBGGGGkGdGdwk.",
    ".kwGGGGGkdGdGwk.",
    ".kwwwwwwwwwwwwk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

// Bookshelf: two wooden shelves (o planks), book spines r/b/G/B/m/y at staggered
// heights, white showing above the short ones.
export const BookshelfIcon: Sprite = {
  title: "文稿",
  titleKey: "app.paper",
  rows: [
    ".kkkkkkkkkkkk.",
    ".krrbbGGwwwwk.",
    ".krrbbGGwwmmk.",
    ".krrbbGGBBmmk.",
    ".krrbbGGBBmmk.",
    ".kooooooooook.",
    ".kBByywwwwbbk.",
    ".kBByyrrwwbbk.",
    ".kBByyrrGGbbk.",
    ".kBByyrrGGbbk.",
    ".kooooooooook.",
    ".kkkkkkkkkkkk.",
  ],
};

// Bazinga: speech bubble + red exclamation mark — an English-learning app that has
// mastered exactly one exclamation.
export const BazingaIcon: Sprite = {
  title: "Bazinga",
  rows: [
    "..kkkkkkkkkkkk..",
    ".kwwwwwwwwwwwwk.",
    ".kwwwwrrwwwwwwk.",
    ".kwwwwrrwwwwwwk.",
    ".kwwwwrrwwwwwwk.",
    ".kwwwwwwwwwwwwk.",
    ".kwwwwrrwwwwwwk.",
    ".kwwwwwwwwwwwwk.",
    "..kkkkkkkkkkkk..",
    "...kkkkk........",
    "..kwwwwk........",
    "..kwwk..........",
    "...kk...........",
  ],
};

// Easter egg: lemonade — glass + lemon-yellow fizz + red-and-white striped straw.
export const LemonadeIcon: Sprite = {
  title: "柠檬水",
  titleKey: "icon.lemonade",
  rows: [
    ".........rr.....",
    ".........ww.....",
    ".kkkkkkkkrrkkkk.",
    ".kwyyyyyyrryyyk.",
    ".kwyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    ".kyyyyyyyyyyyyk.",
    "..kyyyyyyyyyyk..",
    "..koyyyyyyyyok..",
    "..kooooooooook..",
    "...kkkkkkkkkk...",
  ],
};

// Easter egg: cola — red can, silver lid, white diagonal band.
export const ColaIcon: Sprite = {
  title: "可乐",
  titleKey: "icon.cola",
  rows: [
    "....kkkkkkkk....",
    "...knnnnnnnnk...",
    "..kkkkkkkkkkkk..",
    "..krrrrrrrrrrk..",
    "..krrwwwwwrrrk..",
    "..krwwwwwwrrrk..",
    "..krwwwwwwrrrk..",
    "..krrwwwwwrrrk..",
    "..krrrwwwwrrrk..",
    "..krrrrwwwrrrk..",
    "..krrrrrwwwrrk..",
    "..krrrrrrwwwwk..",
    "..kkkkkkkkkkkk..",
    "...knnnnnnnnk...",
    "....kkkkkkkk....",
  ],
};

// Repair TV: a snow-screen TV (rabbit-ear antenna) + an upright wrench — double-click
// opens the repair mini-game; beat it to mute the ambient "signal interference" for
// 10 minutes.
export const RepairTvIcon: Sprite = {
  title: "修理屏幕",
  titleKey: "app.repair",
  rows: [
    "..........kk..kk",
    "..........kn..sk",
    "..........knsssk",
    "...kk.kk...knsk.",
    "..k.....k..knsk.",
    "kkkkkkkkkk.knsk.",
    "kwwwwwwwgk.knsk.",
    "kwdgwdwggk.knsk.",
    "kwwddgwdgk.knsk.",
    "kwgwdwgdgk.knsk.",
    "kwdwgdgwgk.knsk.",
    "kwwgdgwdgk.knsk.",
    "kwgdwwdggk.knsk.",
    "ksssssssdkknnssk",
    "kkkkkkkkkk.kkkk.",
    "..kk..kk........",
  ],
};

// Famicom cartridge: silver shell with grip ridges, label sticker (green mark,
// red stripe), gold-edge contacts peeking at the bottom — double-click opens the
// NES emulator window.
export const CartridgeIcon: Sprite = {
  title: "红白机",
  titleKey: "app.nes.name",
  rows: [
    "....kkkkkkkk....",
    "..kksssssssskk..",
    ".kssssssssssssk.",
    ".kskkkkkkkkkksk.",
    ".kskwwwwwwwwksk.",
    ".kskwwwGGwwwksk.",
    ".kskwwwwwwwwksk.",
    ".kskrrrrrrrrksk.",
    ".kskkkkkkkkkksk.",
    ".kssssssssssssk.",
    ".ksgsgsgsgsgssk.",
    ".kssssssssssssk.",
    ".kddddddddddddk.",
    ".kdydydydydydyk.",
    ".kkkkkkkkkkkkkk.",
  ],
};

// Naval mine (winmine): the authentic Windows 98 minesweeper_0 icon, pixel-
// transcribed from win98icons.alexmeub.com's CSS sprite — its four colors
// (black / gray / silver / white) map 1:1 onto k/g/s/w, so no palette additions.
export const MineIcon: Sprite = {
  title: "扫雷",
  titleKey: "app.mines",
  rows: [
    "................................",
    "................................",
    "...............kk...............",
    "..............kwkk..............",
    "..............kwkk..............",
    "............kkkkkkkk............",
    "......kk..kkwwwwwssskk..kk......",
    ".....kkwkkwwwwswwswwsskkwkk.....",
    ".....kkkkwwsssgwssgssskkkkk.....",
    "......kkwwswwgssssssgsskkk......",
    "......kwwwwsssssssssggskkk......",
    "......kwsssssggssggskgskkk......",
    ".....kwwsgssggggggggsgkgkkk.....",
    ".....kwswwsgsskkkgggggggkkk.....",
    "...kkksswgsggkwwgkggggkgkkkkk...",
    "..kwwkwwgsgggkwwgkkgkggkkkkggk..",
    "..kkkkswwssggkggkkkkgkgkkkkkkk..",
    "...kkkswsssgggkkkkkkggkgkkkkk...",
    ".....kksssgggggkkkkkkgkkkkk.....",
    ".....kkgssgkgkgkkkkkgkgkkkk.....",
    "......kkgkggkgkggkkgkkkkkk......",
    "......kkkgkkgkgkggkkgkkkkk......",
    ".......kkkkgkkgkkkkkkkkkk.......",
    ".......kkkkkkkkkkkkkkkkkk.......",
    "......kgkkkkkkkkkkkkkkkkgk......",
    "......kkkkkkkkkkkkkkkkkkkk......",
    ".......kk...kkkkkkkk...kk.......",
    "..............kkgk..............",
    "..............kkgk..............",
    "...............kk...............",
    "................................",
    "................................",
  ],
};

// Camera (screenshot tool): viewfinder bump, flash cell, lens with a blue glint.
export const CameraIcon: Sprite = {
  title: "截图",
  titleKey: "app.screenshot",
  rows: [
    ".....kkkkk.....",
    "....ksssssk....",
    ".kkkkkkkkkkkkk.",
    "ksswwwsssssssgk",
    "kssssdddddssssk",
    "ksssdBBBdssssgk",
    "ksssdBBBdssssgk",
    "kssssdddddssssk",
    "kssssssssssssgk",
    "kgggggggggggggk",
    ".kkkkkkkkkkkkk.",
  ],
};

// Owner-lock padlocks (doc 08): closed shackle for the locked tray and the
// per-item secret badge; open variant (shackle swung aside) for unlocked.
export const LockIcon: Sprite = {
  title: "已锁定",
  titleKey: "icon.locked",
  rows: [
    "...kkkkkk...",
    "..kk....kk..",
    "..k......k..",
    "..k......k..",
    ".kkkkkkkkkk.",
    ".kyyyyyyyyk.",
    ".kyyyykkyyk.",
    ".kyyyokkoyk.",
    ".kyyyokkoyk.",
    ".kyyyyyyyyk.",
    ".kyooooooyk.",
    ".kkkkkkkkkk.",
  ],
};

export const LockOpenIcon: Sprite = {
  title: "已解锁",
  titleKey: "icon.unlocked",
  rows: [
    "kk..........",
    "kk..........",
    "............",
    "............",
    ".kkkkkkkkkk.",
    ".kyyyyyyyyk.",
    ".kyyyykkyyk.",
    ".kyyyokkoyk.",
    ".kyyyokkoyk.",
    ".kyyyyyyyyk.",
    ".kyooooooyk.",
    ".kkkkkkkkkk.",
  ],
};

// Menu checkmark (the ✓ column in Win95 context menus): marks toggled-on
// surface items such as the CRT dressing shortcut.
export const CheckIcon: Sprite = {
  title: "开",
  titleKey: "ctx.on",
  rows: [
    "..........kk",
    ".........kkk",
    "........kkk.",
    ".......kkk..",
    ".kk...kkk...",
    ".kkk.kkk....",
    "..kkkkk.....",
    "...kkkk.....",
    "....kk......",
  ],
};

/** Corner badge marking a private item; nests inside any icon slot that can
 *  host a `relative` wrapper (desk icon, folder item, shelf tile). */
export function LockBadge({ size = 12 }: { size?: number }) {
  const { t } = useI18n();
  return (
    <span
      aria-label={t("common.private")}
      className="absolute right-0 bottom-0 bg-white bevel-thin-in p-[1px] pointer-events-none"
    >
      <PixelIcon sprite={LockIcon} size={size} />
    </span>
  );
}

// Small icons for dialogs (red X / blue i).
export function GlyphError({ size = 32 }: { size?: number }) {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={t("common.error")}>
      <rect x="1" y="1" width="14" height="14" fill="#c0c0c0" />
      <rect x="1" y="1" width="14" height="14" fill="none" stroke="#0a0a0a" strokeWidth="1" />
      <rect x="2" y="2" width="12" height="1" fill="#fff" />
      <rect x="2" y="2" width="1" height="12" fill="#fff" />
      <rect x="4" y="4" width="8" height="8" fill="#ff0000" />
      <rect x="6" y="6" width="4" height="1" fill="#fff" />
      <rect x="7" y="7" width="2" height="1" fill="#fff" />
      <rect x="6" y="10" width="4" height="1" fill="#fff" />
      <rect x="4" y="4" width="8" height="8" fill="none" stroke="#800000" />
    </svg>
  );
}

export function GlyphInfo({ size = 32 }: { size?: number }) {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={t("common.info")}>
      <rect x="1" y="1" width="14" height="14" fill="#c0c0c0" />
      <rect x="1" y="1" width="14" height="14" fill="none" stroke="#0a0a0a" strokeWidth="1" />
      <rect x="2" y="2" width="12" height="1" fill="#fff" />
      <rect x="2" y="2" width="1" height="12" fill="#fff" />
      <rect x="4" y="4" width="8" height="8" fill="#000080" />
      <rect x="7" y="5" width="2" height="2" fill="#fff" />
      <rect x="7" y="8" width="2" height="3" fill="#fff" />
    </svg>
  );
}
