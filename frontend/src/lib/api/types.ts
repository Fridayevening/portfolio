// Front/back contract types — hand-aligned with NewBoy-server/src/modules/**/dto.ts.
// Once there are more than ~8 hand-aligned interfaces, or misalignment has caused
// rework 3 times, switch to @nestjs/swagger + openapi-typescript generation instead of
// pushing through.

export interface HealthResponse {
  service: string;
  status: string;
  uptime: number;
  timestamp: string;
}

/** Full quote (for snapshots, carries the trend window and day change). */
export interface Quote {
  id: string;
  price: number;
  hist: number[];
  /** Intraday (stocks) / 24h (crypto) percent change. */
  dayPct: number;
}

/** Incremental quote (for ticks; the trend window comes from snapshot/alert — don't
 *  resend 30 numbers every 2 s). */
export interface TickQuote {
  id: string;
  price: number;
}

export interface QuotesResponse {
  at: string;
  quotes: Quote[];
}

export interface AlertPayload {
  key: number;
  /** Symbol id; resolve the display name via the local table in src/lib/market/syms.ts. */
  sym: string;
  /** Display-name fallback for symbols the local table doesn't know (server
   *  watchlist additions). */
  name?: string;
  price: number;
  /** Intraday (stocks) / 24h (crypto) percent change — the client composes the
   *  localized copy from this. */
  dayPct?: number;
  /** Stocks show "intraday", crypto shows "24h". */
  kind?: "stock" | "crypto";
  /** Pre-formatted copy (the offline mirror engine provides it; the server
   *  leaves it out so the client can localize). */
  msg?: string;
  up: boolean;
  hist: number[];
  at: string;
}

/** Event stream of SSE /v1/market/stream. */
export type StreamEvent =
  | { type: "snapshot"; at: string; quotes: Quote[] }
  | { type: "tick"; at: string; quotes: TickQuote[] }
  | { type: "alert"; at: string; alert: AlertPayload };

// ── hotaru (retro processing) contract — hand-aligned with NewBoy-server/src/modules/hotaru/dto.ts ──

export type HotaruPalette = "relic" | "pool" | "omoide" | "liminal" | "vapor" | "eva" | "original";

/** Style parameters shared by image/video; all optional — omissions fall back to the
 *  server's (Python) defaults. */
export interface HotaruBaseOptions {
  /** Palette (gradient mapping, conceptual names); original = keep colors, retro-TV
   *  processing only. */
  palette?: HotaruPalette;
  /** Random seed: the same seed reproduces grain/scratches. */
  seed?: number;
  /** Negative: inverts luminance. */
  invert?: boolean;
  /** Glow strength multiplier, 0-2. */
  glow?: number;
  /** Ghost strength, 0-1.8. */
  ghost?: number;
  /** Tint opacity, 0-1; omitted = the palette's default. */
  tint?: number;
  /** miniDV interlace comb shift in px (0 = off). */
  dvShift?: number;
  /** Haze veil, 0-1. */
  haze?: number;
}

/** Image-side parameters: dv omitted = off (the video pipeline is DV-only by design). */
export interface HotaruImageOptions extends HotaruBaseOptions {
  /** miniDV: chroma = teal noise / original = no green noise; omitted = off. */
  dv?: "chroma" | "original";
}

/** Video-side parameters: dv defaults to chroma-on (the medium's native look); off is
 *  what disables it — semantics differ from the image side. */
export interface HotaruVideoOptions extends HotaruBaseOptions {
  dv?: "chroma" | "original" | "off";
  /** Tape dropout streak strength, 0-5. */
  dropout?: number;
  /** Previous-frame persistence (phosphor trails), 0-0.5. */
  afterglow?: number;
  /** Grain strength multiplier, 0-1 (the biggest lever on video size). */
  grain?: number;
  /** Width cap in px (0 = no cap; only shrinks, never upscales). */
  width?: number;
  /** Height cap in px (0 = no cap; portrait video's long edge is the height, so this
   *  is the one that squeezes). */
  height?: number;
  /** x264 quality, 18-30 (lower = sharper and bigger). */
  crf?: number;
}

export type HotaruJobStatus = "queued" | "processing" | "done" | "failed";

/** Video processing progress (parsed server-side from the processing script's stdout
 *  progress lines). */
export interface HotaruJobProgress {
  frame: number;
  total: number | null;
  percent: number | null;
  fps: number | null;
  etaSeconds: number | null;
}

/** Response of POST /v1/hotaru/video. */
export interface HotaruSubmitResponse {
  jobId: string;
}

/** Response of GET /v1/hotaru/video/:jobId; 404 = job missing or expired (same meaning
 *  after a server restart). */
export interface HotaruJob {
  jobId: string;
  status: HotaruJobStatus;
  progress: HotaruJobProgress | null;
  /** While queued = how many jobs are ahead (0 = next to run); null otherwise. */
  queuePosition: number | null;
  /** When failed = server-side error detail (tail of stderr). */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response of GET /v1/hotaru/ping (environment self-check). */
export interface HotaruPingResponse {
  /** The interpreter path the server actually uses. */
  python: string;
  pythonOk: boolean;
  /** ffprobe only affects rotation metadata on portrait video; missing is not
   *  fatal. */
  ffprobe: boolean;
}

// ── news contract — hand-aligned with newboy-server/src/modules/news/dto.ts ──
// One flash = one AI-curated financial wire brief (stocks / crypto / macro);
// the server pulls four vertical RSS feeds through DeepSeek curation.

export interface NewsFlash {
  /** Desk: STOCKS / CRYPTO / MACRO. */
  section: string;
  /** Publication day, UTC "YYYY-MM-DD". */
  day: string;
  /** AI-written English short headline (ALL CAPS); null on raw-headline
   *  items — the card then falls back to first-sentence-as-headline. */
  headline: string | null;
  /** AI-written Chinese headline — the card's default display; English is
   *  carried in the response but not rendered for now. Null on raw items. */
  headlineZh: string | null;
  /** Ticker/asset/theme tag, e.g. "FED · RATES". */
  kicker: string;
  /** The full English dispatch — 1-3 sentence brief on AI items, title
   *  (+summary) on raw items. */
  text: string;
  /** The Chinese brief — the card's default display; null on raw items. */
  textZh: string | null;
  /** Editorial take (Chinese, 2-4 sentences): market impact, winners/losers,
   *  what to watch. Rendered ONLY in the detail window — never on the card;
   *  null on raw items. */
  analysis: string | null;
  /** First wire source URL; null = no outbound link on the detail paper. */
  url: string | null;
  /** Wire bylines, e.g. ["CNBC"]. */
  wires: string[];
}

/** Response of GET /v1/news/today (the desktop newspaper card; the server
 *  refreshes its cache morning and evening). */
export interface NewsTodayResponse {
  at: string;
  flashes: NewsFlash[];
}


// ── 文稿 (articles) ────────────────────────────────────────────
// Hand-aligned with newboy-server/src/modules/articles/dto.ts.

/** List entry (GET /v1/articles) — the paper grid; body not included. */
export interface ArticleSummary {
  id: string;
  /** Display name including the .md suffix. */
  name: string;
  /** Non-whitespace char count (CJK word count), same rule as the status bar. */
  chars: number;
  /** ISO creation time (from meta.json, not fs birthtime). */
  createdAt: string;
  /** ISO last-save time (the .md file's mtime). */
  updatedAt: string;
  /** Private flag (doc 08): absent from the visitor's world entirely; omitted
   *  from the payload when public. */
  secret?: boolean;
}

/** Full article (GET/:id, POST, PUT) — adds the markdown source. */
export interface Article extends ArticleSummary {
  body: string;
}


// ── 桌面文件系统 (files) ───────────────────────────────────────
// Hand-aligned with newboy-server/src/modules/files/dto.ts.

export type FsType = "folder" | "doc" | "image";

/** One desktop-filesystem node (list/create/get). Docs reference an article;
 *  images keep their bytes server-side (.data/files) until CDN storage lands. */
export interface FsNode {
  id: string;
  type: FsType;
  name: string;
  /** Parent folder id; null = the desktop surface itself. */
  parent: string | null;
  /** Set for type="doc" — the article PAPER opens. */
  articleId: string | null;
  /** ".png" for images. */
  ext: string | null;
  mime: string | null;
  /** Bytes for images. */
  size: number | null;
  createdAt: string;
  updatedAt: string;
  /** Private flag (doc 08): hidden from visitors (subtree and linked article
   *  follow server-side); omitted from the payload when public. */
  secret?: boolean;
}

/** One trash entry (GET /files/trash): where the item lived and when the
 *  server-side 7-day retention expires. */
export interface TrashNode extends FsNode {
  deletedFromPath: string;
  purgeAt: string;
}


// ── lab (image laboratory) contract — hand-aligned with newboy-server/src/modules/lab/dto.ts ──

export type LaserCardJobStatus = "queued" | "processing" | "done" | "failed";

/** Pipeline phase of a laser-card render; progress only advances at stage
 *  boundaries (Blender prints no per-sample output in background mode). */
export type LaserCardStage = "textures" | "front" | "3d" | "alpha" | "glb";

/** Which artifact to fetch: front still / angled still / transparent cutout / GLB. */
export type LaserCardKind = "front" | "3d" | "alpha" | "glb";

/** Response of POST /v1/lab/laser-card. */
export interface LaserCardSubmitResponse {
  jobId: string;
}

/** Response of GET /v1/lab/laser-card/:jobId; 404 = job missing or expired (same
 *  meaning after a server restart). */
export interface LaserCardJob {
  jobId: string;
  status: LaserCardJobStatus;
  stage: LaserCardStage | null;
  /** 0-100, null while queued. */
  progress: number | null;
  /** While queued = how many jobs are ahead (0 = next to run); null otherwise. */
  queuePosition: number | null;
  /** When failed = server-side error detail. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Response of GET /v1/lab/ping (environment self-check). */
export interface LabPingResponse {
  python: string;
  pythonOk: boolean;
  blender: string;
  blenderOk: boolean;
}


/** Interface preferences (settings sheet), one namespace of the preferences doc.
 *  Hand-aligned with server modules/preferences/dto.ts. */
export interface UiPrefs {
  /** CRT dressing master switch (scanlines, vignette, flicker, curvature). */
  crt: boolean;
  /** Curved-glass mode; only visibly applies while crt is on. */
  glass: boolean;
  /** Desktop fill, #rrggbb from the settings sheet swatches. */
  desktopColor: string;
}

/** Desktop layout, second namespace of the preferences doc. iconPos maps icon id →
 *  pixel position; fs-* keys may outlive their file (lookups are by live id only). */
export interface DesktopPrefs {
  iconPos: Record<string, { x: number; y: number }>;
}

/** Privacy strategy, third namespace (doc 08 §1.2 — the curation layer's data
 *  side). Owner-only effect: hidden apps vanish from the VISITOR's desk; the
 *  owner always sees everything. Contains no content, safe to serve publicly. */
export interface PrivacyPrefs {
  /** Window/app ids hidden from visitors (desk icons, start menu, open/run). */
  hiddenApps: string[];
  /** Applied to newly created articles/files until toggled otherwise. */
  defaultSecret: boolean;
}

/** Response of GET /v1/preferences; null body = the server has never seen any.
 *  PUT sends the same shape minus updatedAt, one or more namespaces. */
export interface PreferencesResponse {
  ui: UiPrefs;
  desktop: DesktopPrefs;
  privacy: PrivacyPrefs;
  updatedAt: string;
}
