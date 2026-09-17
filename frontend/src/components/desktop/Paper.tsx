"use client";

// PAPER.EXE — the tabbed markdown writing app behind the PAPER bookshelf
// icon. Articles live on newboy-server (MongoDB); this component talks to
// it through lib/api/articles.ts: shelf = GET list, tab open = lazy GET, edits =
// debounced PUT (2 s) with Ctrl+S flushing immediately, closing a dirty tab
// flushes before closing. Filenames default to the article's first # heading
// until a manual rename (shelf right-click / F2) pins them. Without the server
// the shelf shows an offline note — the open-source frontend stays functional,
// just with an empty peper.
// The mini markdown renderer below is still placeholder; a real parser is a
// feature-stage topic.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDesktop, type DesktopApi, type DynamicWindowDef } from "./context";
import { useContextMenu } from "./ContextMenu";
import type { MenuItem } from "./menu";
import { StatusBar } from "./windows";
import { BookshelfIcon, LockBadge, MdDocIcon, PixelIcon } from "./icons";
import { createArticle, getArticle, listArticles, removeArticle, saveArticle, setArticleSecret } from "../../lib/api/articles";
import { useOwnerState } from "../../lib/api/owner";
import { peekPrivacy } from "./prefsState";
import type { ArticleSummary } from "../../lib/api/types";
import { currentT } from "../../lib/i18n/dict";
import { useI18n } from "../../lib/i18n/LanguageContext";

// Shared with Desktop's WIN_DEFS entry so title updates via openDef never drift
// the geometry.
export const PAPER_GEOM = { w: 640, h: 480, x: 340, y: 110 } as const;

/** An open-this-article request handed in through the window def's render. */
type FocusReq = { id: string; seq: number };

type ViewMode = "edit" | "preview" | "split";

type Doc = {
  id: string;
  name: string;
  body: string;
  /** Name still follows the first # heading; a manual rename fixes it. */
  autoName: boolean;
  view: ViewMode;
  /** Edited since last successful save (title * and tab ●). */
  dirty: boolean;
  /** A PUT is in flight for this doc. */
  saving: boolean;
  /** Last PUT failed (offline blip etc.) — dirty stays, next edit/Ctrl+S retries. */
  saveError: boolean;
  /** Epoch ms of the last successful save; null = opened pristine, never saved here. */
  savedAt: number | null;
  /** Server-reported count; the shelf total uses it for unloaded docs. */
  chars: number;
  /** body fetched (list entries load lazily on first tab open). */
  loaded: boolean;
  /** Private flag (doc 08): server hides it from visitors; owner sees a lock. */
  secret: boolean;
};

const SHELF = "shelf";
const AUTOSAVE_MS = 2000;

// ── Mini markdown renderer (prototype) ────────────────

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("`")) out.push(
      <code key={k} className="font-mono text-[12px] bg-[#efefe7] px-[3px]">
        {t.slice(1, -1)}
      </code>,
    );
    else if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("*")) out.push(<em key={k}>{t.slice(1, -1)}</em>);
    else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      out.push(
        <a key={k} href={mm[2]} className="text-[#0000ee] underline">
          {mm[1]}
        </a>,
      );
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEAD_CLS: Record<string, string> = {
  h1: "text-[21px] font-bold leading-snug border-b border-black/40 pb-[6px] mb-[14px]",
  h2: "text-[16px] font-bold mt-[18px] mb-[8px]",
  h3: "text-[14px] font-bold mt-[14px] mb-[6px]",
};

// Task-list markers [x]/[ ] become ✓/□ chips — checklists are a writing habit,
// not a syntax to learn.
function bullet(text: string, key: string): ReactNode {
  const task = /^\[( |x)\]\s+/.exec(text);
  if (!task) return inline(text, key);
  return (
    <>
      <span className="inline-block w-[14px] text-center mr-[4px]">
        {task[1] === "x" ? "✓" : "□"}
      </span>
      {inline(text.slice(task[0].length), `${key}t`)}
    </>
  );
}

function renderMarkdown(src: string): ReactNode[] {
  const lines = src.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `md-${key++}`;
  // Indented block (4 spaces): treated as code — keeps docs readable without
  // fenced blocks cluttering the editor's left margin.
  const isBlock = (s: string) => s.startsWith("    ") && s.trim();
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (isBlock(line)) {
      const buf: string[] = [];
      while (i < lines.length && (isBlock(lines[i]) || !lines[i].trim())) buf.push(lines[i++].slice(4));
      out.push(
        <pre key={k()} className="font-mono text-[12px] leading-[1.6] bg-[#f4f2ea] bevel-thin-in p-2 my-[10px] overflow-auto whitespace-pre">
          {buf.join("\n").trimEnd()}
        </pre>,
      );
      continue;
    }
    const h = /^(#{1,3})\s+(.*)/.exec(line);
    if (h) {
      const Tag = (["h1", "h2", "h3"] as const)[h[1].length - 1];
      out.push(
        <Tag key={k()} className={HEAD_CLS[Tag]}>
          {inline(h[2], k())}
        </Tag>,
      );
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push(<hr key={k()} className="border-0 border-t border-black/40 my-[16px]" />);
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push(
        <blockquote key={k()} className="border-l-[3px] border-[#9a9a8e] pl-[10px] my-[10px] italic text-black/60">
          {buf.map((b, bi) => (
            <p key={bi} className="leading-[1.8]">{inline(b, `${key}-${bi}`)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out.push(
        <ul key={k()} className="my-[8px] space-y-[4px]">
          {buf.map((b, bi) => (
            <li key={bi} className="leading-[1.8] pl-[16px] relative before:content-['•'] before:absolute before:left-0">
              {bullet(b, `${key}-${bi}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*\d+\.\s+/, ""));
      out.push(
        <ol key={k()} className="my-[8px] space-y-[4px] list-decimal pl-[22px]">
          {buf.map((b, bi) => (
            <li key={bi} className="leading-[1.8]">{inline(b, `${key}-${bi}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    // Paragraph: consecutive plain lines merge into one flow (Chinese prose has no
    // hard wraps).
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#|>|\d+\.|[-*]\s|    )/.test(lines[i])
    )
      buf.push(lines[i++]);
    out.push(
      <p key={k()} className="my-[8px] leading-[1.9] text-[13.5px]">
        {inline(buf.join(""), k())}
      </p>,
    );
  }
  return out;
}

// CJK word count: non-whitespace chars (a word in Chinese, a letter in English —
// the way writers actually count).
function countChars(s: string): number {
  return s.replace(/\s/g, "").length;
}

const NAME_MAX = 100; // server DTO caps name at 100 chars

const UNTITLED_RE = /^(未命名|Untitled)-\d+\.md$/;

/** Default filename = first #/##/### heading, capped to fit ".md" inside NAME_MAX.
 *  No heading → null, so an untitled document keeps its generated name. */
function deriveName(body: string): string | null {
  for (const line of body.split("\n")) {
    const h = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (h) return `${h[1].trim().slice(0, NAME_MAX - 3)}.md`;
  }
  return null;
}

/** Shelf entry → tab-ready Doc (body lazy-loads on first open). */
function summaryToDoc(s: ArticleSummary): Doc {
  return {
    id: s.id,
    name: s.name,
    body: "",
    autoName: true,
    view: "edit",
    dirty: false,
    saving: false,
    saveError: false,
    savedAt: null,
    chars: s.chars,
    loaded: false,
    secret: s.secret === true,
  };
}

let focusSeq = 0;

// The window def shared by the live-title effect and openArticleInPaper, so
// geometry and icon never drift. `focus` rides the render closure — the legal
// way to hand an already-open window new intent (openDef swaps content and
// refocuses; a closed window just opens with it).
function paperDef(focus?: FocusReq): DynamicWindowDef {
  return {
    id: "paper",
    title: currentT("app.paper.title"),
    icon: <PixelIcon sprite={BookshelfIcon} size={14} />,
    ...PAPER_GEOM,
    render: () => <PaperWindow focus={focus} />,
  };
}

/** Open (or refocus) PAPER landed on a specific article — desktop doc icons and
 *  folder windows call this on double-click. */
export function openArticleInPaper(api: DesktopApi, articleId: string) {
  api.openDef(paperDef({ id: articleId, seq: ++focusSeq }));
}

// ── Window ────────────────────────────────────────────

export default function PaperWindow({ focus }: { focus?: FocusReq }) {
  const api = useDesktop();
  const { t, lang } = useI18n();
  const ownerState = useOwnerState();
  // Visitor (or owner rehearsing the visitor view) reads but never writes.
  const canEdit = !!ownerState.token && !ownerState.preview;
  const [docs, setDocs] = useState<Doc[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "offline">("loading");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>(SHELF);
  const [selId, setSelId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [caret, setCaret] = useState({ ln: 1, col: 1 });
  const [newSeq, setNewSeq] = useState(0);
  // Two-step delete: first click arms the button, second click within 5 s deletes.
  const [armDelete, setArmDelete] = useState<string | null>(null);
  // The in-place rename editor.
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const docsRef = useRef<Doc[]>([]);
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDoc = docs.find((d) => d.id === activeTab) ?? null;

  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);

  // Shelf bootstrap: one list call decides ready/offline for the whole window.
  // ownerState dep: identity flips (unlock/lock/preview) re-list under the new
  // viewer — the server decides visibility, the shelf just re-asks (doc 08).
  useEffect(() => {
    let alive = true;
    listArticles()
      .then((ss) => {
        if (!alive) return;
        setDocs(ss.map(summaryToDoc));
        setPhase("ready");
      })
      .catch(() => alive && setPhase("offline"));
    return () => {
      alive = false;
    };
  }, [ownerState]);

  const patch = useCallback(
    (id: string, p: Partial<Doc>) =>
      setDocs((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d))),
    [],
  );

  const doSave = useCallback(
    async (id: string) => {
      const d = docsRef.current.find((x) => x.id === id);
      if (!d || !d.dirty || d.saving) return;
      patch(id, { saving: true, saveError: false });
      try {
        // Auto-named docs re-derive their filename from the first heading on
        // every save — the heading IS the title until the user overrides it.
        const derived = d.autoName ? deriveName(d.body) : null;
        const a = await saveArticle(id, d.body, derived ?? undefined);
        // Keystrokes during the PUT: keep dirty so the next debounce saves them.
        const now = docsRef.current.find((x) => x.id === id);
        patch(id, {
          saving: false,
          dirty: now ? now.body !== a.body : false,
          savedAt: Date.parse(a.updatedAt),
          chars: a.chars,
          ...(derived ? { name: a.name } : {}),
        });
      } catch {
        patch(id, { saving: false, saveError: true });
      }
    },
    [patch],
  );

  // The unmount flush and the debounce timers must call the latest doSave; a ref
  // keeps them stable without re-subscribing on every identity change.
  const doSaveRef = useRef(doSave);
  useEffect(() => {
    doSaveRef.current = doSave;
  }, [doSave]);

  // Flush every dirty doc on unmount (window X / shutdown) — the fetch survives
  // the component going away; only a full page unload could cut it.
  useEffect(
    () => () => {
      for (const t of saveTimers.current.values()) clearTimeout(t);
      for (const d of docsRef.current) if (d.dirty) void doSaveRef.current(d.id);
    },
    [],
  );

  const scheduleSave = useCallback((id: string) => {
    const timers = saveTimers.current;
    const old = timers.get(id);
    if (old) clearTimeout(old);
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void doSaveRef.current(id);
      }, AUTOSAVE_MS),
    );
  }, []);

  const flushSave = useCallback((id: string) => {
    const timers = saveTimers.current;
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
    void doSaveRef.current(id);
  }, []);

  // Close the menu bar on any click outside it, or on Escape.
  useEffect(() => {
    const off = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", off);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", off);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  // Live window title: the app title on the shelf tab, or a starred name when dirty.
  // doc. Re-openDef swaps the def in place (existing windows only refocus) — and
  // must carry the current focus along, else the swap would drop an unconsumed
  // request (phase still loading) along with the prop.
  useEffect(() => {
    const title = !activeDoc
      ? t("app.paper.title")
      : `${activeDoc.dirty ? "*" : ""}${activeDoc.name} - ${t("paper.titleSuffix")}`;
    api.openDef({ ...paperDef(focus), title });
    // api is stable; docs identity churns on every keystroke, so depend on the
    // fields the title actually reads. focus.seq matters for the refocus-same-
    // doc case: openDef swaps in the default title, and without this dep no
    // other value changes to correct it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDoc?.name, activeDoc?.dirty, activeTab, focus?.seq]);

  const openDoc = useCallback(
    (id: string) => {
      setOpenTabs((t) => (t.includes(id) ? t : [...t, id]));
      setActiveTab(id);
      const d = docsRef.current.find((x) => x.id === id);
      if (!d || d.loaded) return;
      getArticle(id)
        .then((a) =>
          patch(id, {
            body: a.body,
            chars: a.chars,
            loaded: true,
            // Re-derive follow mode across window reopenings: a name that is
            // neither the untitled default nor the heading derivation was set
            // by hand and must not be overwritten.
            autoName: UNTITLED_RE.test(a.name) || a.name === deriveName(a.body),
          }),
        )
        .catch(() =>
          api.dialog(t("paper.dialogTitle"), [t("paper.readFail"), t("paper.maybeOffline")], "info"),
        );
    },
    [api, patch],
  );

  // External focus requests (desktop doc icon double-click) ride the def's render
  // closure in as a prop. Gated on phase: a freshly mounted window is still
  // listing, and the request waits for ready. The seq guard makes the open
  // idempotent across StrictMode double-fires and the fresh object identities
  // the render closure mints per render.
  const openedSeq = useRef(0);
  useEffect(() => {
    if (!focus || phase !== "ready") return;
    if (openedSeq.current === focus.seq) return;
    openedSeq.current = focus.seq;
    const id = focus.id;
    if (docsRef.current.some((d) => d.id === id)) {
      openDoc(id);
      return;
    }
    // The shelf list predates the article (window open since before it was
    // created): one refresh, then open — or report the miss.
    listArticles()
      .then((ss) => {
        setDocs(ss.map(summaryToDoc));
        if (ss.some((s) => s.id === id)) openDoc(id);
        else api.dialog(t("paper.dialogTitle"), [t("paper.missing"), t("paper.maybeDeleted")], "info");
      })
      .catch(() => api.dialog(t("paper.dialogTitle"), [t("paper.openFail")], "info"));
  }, [focus, phase, openDoc, api]);

  const closeTab = useCallback(
    (id: string) => {
      // Dirty docs flush before the tab goes — closing must never eat the last
      // debounce window of typing.
      const d = docsRef.current.find((x) => x.id === id);
      if (d?.dirty) flushSave(id);
      setOpenTabs((t) => t.filter((x) => x !== id));
      setActiveTab((cur) => (cur === id ? SHELF : cur));
    },
    [flushSave],
  );

  const newDoc = useCallback(async () => {
    const n = newSeq + 1;
    try {
      // New documents inherit the default privacy preference and remain toggleable.
      const a = await createArticle(t("paper.untitled").replace("{n}", String(n)), peekPrivacy().defaultSecret);
      setNewSeq(n);
      setDocs((ds) => [
        ...ds,
        {
          id: a.id,
          name: a.name,
          body: "",
          autoName: true,
          view: "edit",
          dirty: false,
          saving: false,
          saveError: false,
          savedAt: null,
          chars: 0,
          loaded: true,
          secret: a.secret === true,
        },
      ]);
      setOpenTabs((t) => (t.includes(a.id) ? t : [...t, a.id]));
      setActiveTab(a.id);
    } catch {
      api.dialog(t("paper.dialogTitle"), [t("paper.createFail"), t("paper.serverHome")]);
    }
  }, [newSeq, api]);

  const deleteDoc = useCallback(() => {
    if (!selId) return;
    if (armDelete !== selId) {
      setArmDelete(selId);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmDelete(null), 5000);
      return;
    }
    const id = selId;
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmDelete(null);
    removeArticle(id)
      .then(() => {
        setDocs((ds) => ds.filter((d) => d.id !== id));
        setOpenTabs((t) => t.filter((x) => x !== id));
        setActiveTab((cur) => (cur === id ? SHELF : cur));
        setSelId(null);
        setRenameId(null);
      })
      .catch(() => api.dialog(t("paper.dialogTitle"), [t("paper.deleteFail")]));
  }, [selId, armDelete, api]);

  const beginRename = useCallback((id: string) => {
    const d = docsRef.current.find((x) => x.id === id);
    if (!d) return;
    setRenameId(id);
    setRenameVal(d.name);
  }, []);

  // Privacy matches the desktop file system; patch locally because only visitor
  // visibility changes and the owner view keeps every item.
  const toggleSecretDoc = useCallback(
    (id: string) => {
      const cur = docsRef.current.find((d) => d.id === id);
      if (!cur) return;
      setArticleSecret(id, !cur.secret)
        .then(() => patch(id, { secret: !cur.secret }))
        .catch(() => api.dialog(t("paper.privateTitle"), [t("paper.privateFail")]));
    },
    [api, patch],
  );

  const menu = useContextMenu();
  // The context-menu provider holds the items factory past this render, so the
  // factory must read state through this ref — closures would go stale the
  // moment armDelete or the picked document changes. Layout-effect
  // (not useEffect) so the write lands before the provider's keepOpen refresh,
  // which re-runs the factory in a later commit; child effects fire first.
  const live = useRef({ armDelete, deleteDoc, beginRename, toggleSecretDoc, canEdit });
  useLayoutEffect(() => {
    live.current = { armDelete, deleteDoc, beginRename, toggleSecretDoc, canEdit };
  }, [armDelete, deleteDoc, beginRename, toggleSecretDoc, canEdit]);

  // Shelf right-click menu. The unarmed delete action reopens as confirmation;
  // armed variant in place; the armed click deletes (deleteDoc branches on
  // armDelete) and the menu closes.
  function shelfMenu(id: string, armed: boolean): MenuItem[] {
    const { canEdit: writable } = live.current;
    const secret = docsRef.current.find((d) => d.id === id)?.secret === true;
    return [
      { kind: "item", label: t("paper.rename"), hint: "F2", disabled: !writable, action: () => live.current.beginRename(id) },
      {
        kind: "item",
        label: secret ? t("paper.makePublic") : t("paper.makePrivate"),
        disabled: !writable,
        action: () => live.current.toggleSecretDoc(id),
      },
      {
        kind: "item",
        label: armed ? t("paper.confirmDelete") : t("paper.delete"),
        danger: armed,
        disabled: !writable,
        action: armed
          ? () => live.current.deleteDoc()
          : (ctl) => {
              live.current.deleteDoc();
              ctl.reopen(shelfMenu(id, true));
            },
      },
    ];
  }

  const doRename = useCallback(
    async (id: string, raw: string) => {
      const name = raw.trim().slice(0, NAME_MAX);
      const d = docsRef.current.find((x) => x.id === id);
      if (!d || !name || name === d.name) return;
      // PUT is full-body: an unloaded doc needs its body fetched first.
      let body = d.body;
      if (!d.loaded) {
        try {
          body = (await getArticle(id)).body;
        } catch {
          api.dialog(t("paper.dialogTitle"), [t("paper.renameFail")]);
          return;
        }
      }
      // The rename PUT carries the latest body, so a pending debounce save is
      // superseded, and saving=true keeps a concurrent autosave out of the way.
      const timer = saveTimers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        saveTimers.current.delete(id);
      }
      patch(id, { name, autoName: false, saving: true, saveError: false });
      try {
        const a = await saveArticle(id, body, name);
        const now = docsRef.current.find((x) => x.id === id);
        patch(id, {
          saving: false,
          dirty: now ? now.body !== a.body : false,
          savedAt: Date.parse(a.updatedAt),
          chars: a.chars,
          name: a.name,
        });
      } catch {
        // Roll the shelf back so the failed rename doesn't read as done; the
        // doc keeps whatever dirty body it had, retried by the next edit.
        patch(id, { name: d.name, autoName: d.autoName, saving: false });
        api.dialog(t("paper.dialogTitle"), [t("paper.renameFail")]);
      }
    },
    [api, patch],
  );

  // Enter and blur both land here; unmounting the input after setRenameId(null)
  // fires a second blur that no-ops on the null state.
  const commitRename = useCallback(() => {
    const id = renameId;
    if (!id) return;
    setRenameId(null);
    void doRename(id, renameVal);
  }, [renameId, renameVal, doRename]);

  // F2 renames the selected shelf item, Explorer-style.
  useEffect(() => {
    if (activeTab !== SHELF) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F2" || renameId || !selId) return;
      e.preventDefault();
      beginRename(selId);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeTab, selId, renameId, beginRename]);

  const menuItems = (name: string): { label: string; checked?: boolean; onPick?: () => void }[] | null => {
    switch (name) {
      case t("paper.menu.file"):
        return [
          { label: t("paper.newArticle"), onPick: () => void newDoc() },
          {
            label: t("paper.save"),
            onPick: () => activeDoc && flushSave(activeDoc.id),
          },
          { label: t("paper.closeTab"), onPick: () => activeDoc && closeTab(activeDoc.id) },
        ];
      case t("paper.menu.view"):
        if (!activeDoc) return null;
        return (["edit", "preview", "split"] as const).map((v) => ({
          label: { edit: t("paper.edit"), preview: t("paper.preview"), split: t("paper.split") }[v],
          checked: activeDoc.view === v,
          onPick: () => patch(activeDoc.id, { view: v }),
        }));
      case t("paper.menu.window"):
        return [
          { label: t("paper.shelf"), checked: activeTab === SHELF, onPick: () => setActiveTab(SHELF) },
          ...openTabs.map((id) => {
            const d = docs.find((x) => x.id === id)!;
            return { label: d.name, checked: activeTab === id, onPick: () => openDoc(id) };
          }),
        ];
      case t("paper.menu.help"):
        return [
          {
            label: t("paper.aboutMenu"),
            onPick: () =>
              api.dialog(t("paper.aboutTitle"), [
                t("paper.aboutVersion"),
                "",
                t("paper.aboutWork"),
                t("paper.aboutSave"),
              ], "info"),
          },
        ];
      default:
        return null; // Edit and Search remain decorative, like the rest of the desktop.
    }
  };

  const menus = [t("paper.menu.file"), t("paper.menu.edit"), t("paper.menu.search"), t("paper.menu.view"), t("paper.menu.window"), t("paper.menu.help")];

  const savedLabel = (d: Doc) =>
    d.saveError
      ? t("paper.saveFailed")
      : d.saving
        ? t("paper.saving")
        : d.dirty
          ? t("paper.unsaved")
          : d.savedAt
            ? t("paper.saved").replace("{time}", new Date(d.savedAt).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit" }))
            : t("paper.synced");

  const editPane = (d: Doc, className: string) => (
    <textarea
      value={d.body}
      spellCheck={false}
      onChange={(e) => {
        patch(d.id, { body: e.target.value, dirty: true, saveError: false, chars: countChars(e.target.value) });
        scheduleSave(d.id);
      }}
      onSelect={(e) => {
        const el = e.currentTarget;
        const before = d.body.slice(0, el.selectionStart).split("\n");
        setCaret({ ln: before.length, col: before[before.length - 1].length + 1 });
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          flushSave(d.id);
        }
      }}
      placeholder={t("paper.placeholder")}
      className={`bg-white outline-none resize-none p-3 font-mono text-[13px] leading-[1.8] text-[#0a0a0a] placeholder:text-black/30 ${className}`}
    />
  );

  const previewPane = (d: Doc, className: string) => (
    <div className={`bg-chrome overflow-auto p-3 ${className}`}>
      <div className="paper-serif mx-auto max-w-[440px] bg-white border border-[#808080] px-9 py-8 text-[#0a0a0a]"
        style={{ boxShadow: "4px 5px 12px rgba(0,0,0,.5)" }}>
        {!d.loaded ? (
          <p className="text-black/30 italic">{t("paper.opening")}</p>
        ) : d.body.trim() ? (
          renderMarkdown(d.body)
        ) : (
          <p className="text-black/30 italic">{t("paper.blank")}</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Menu bar (self-drawn: the shared MenuBar is display-only) */}
      <div ref={menuRef} className="relative flex items-center gap-[2px] px-1 py-[2px] text-[12px] shrink-0">
        {/* eslint-disable-next-line react-hooks/refs -- menuItems only builds descriptors here; its onPick closures run on click, where reading doSaveRef/docsRef (async save needs the latest doc) is legal */}
        {menus.map((m) => {
          const items = menuItems(m);
          return (
            <div key={m} className="relative">
              <button
                type="button"
                className={`px-[6px] py-[1px] select-none ${
                  openMenu === m && items ? "bg-navy text-white" : "hover:bg-navy hover:text-white"
                }`}
                onClick={() => items && setOpenMenu(openMenu === m ? null : m)}
                onPointerEnter={() => items && openMenu && openMenu !== m && setOpenMenu(m)}
              >
                {m}
              </button>
              {openMenu === m && items && (
                <div className="absolute left-0 top-full z-30 min-w-[150px] bg-chrome bevel-out p-[3px]">
                  {items.map((it, ii) => (
                    <button
                      key={ii}
                      type="button"
                      className="flex w-full items-center gap-2 px-[6px] py-[2px] text-left text-[12px] whitespace-nowrap hover:bg-navy hover:text-white"
                      onClick={() => {
                        setOpenMenu(null);
                        it.onPick?.();
                      }}
                    >
                      <span className="w-[12px] shrink-0">{it.checked ? "✓" : ""}</span>
                      {it.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <span className="ml-auto pr-1 text-[9px] text-black/50 select-none shrink-0 whitespace-nowrap">
          {t("paper.shelf")} · PAPER
        </span>
      </div>

      {/* Tab strip: the shelf tab is pinned first; doc tabs carry dirty dots */}
      <div className="flex items-end gap-[2px] px-[3px] shrink-0">
        <button
          type="button"
          className={`wtab flex items-center gap-[4px] h-[20px] pl-[7px] pr-[10px] text-[11px] ${
            activeTab === SHELF ? "wtab-on bg-white font-bold" : "bg-chrome mt-[1px]"
          }`}
          onClick={() => setActiveTab(SHELF)}
        >
          <PixelIcon sprite={BookshelfIcon} size={12} />
          {t("paper.shelf")}
        </button>
        {openTabs.map((id) => {
          const d = docs.find((x) => x.id === id)!;
          return (
            <div
              key={id}
              className={`wtab flex items-center h-[20px] pl-[6px] pr-[3px] text-[11px] max-w-[150px] ${
                activeTab === id ? "wtab-on bg-white font-bold" : "bg-chrome mt-[1px]"
              }`}
            >
              <button
                type="button"
                className="flex items-center gap-[4px] min-w-0"
                onClick={() => setActiveTab(id)}
              >
                <PixelIcon sprite={MdDocIcon} size={12} className="shrink-0" />
                <span className="truncate">{d.name}</span>
                {d.dirty && <span title={t("paper.unsaved")}>●</span>}
              </button>
              <button
                type="button"
                aria-label={t("paper.closeAria").replace("{name}", d.name)}
                className="w-[14px] h-[13px] ml-[4px] shrink-0 flex items-center justify-center text-[9px] hover:bg-[#c02020] hover:text-white"
                onClick={() => closeTab(id)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Content frame: one sunken bevel; the active tab's white bleed-down covers
          its top edge (the "connected page" look of the 95 tab control). */}
      {activeTab === SHELF ? (
        <div className="flex flex-col flex-1 min-h-0 bg-white bevel-in p-2 gap-2">
          <div className="flex gap-[3px] shrink-0">
            <button
              type="button"
              className="bevel-thin-out bg-chrome px-2 py-[2px] text-[11px] press disabled:text-black/40"
              disabled={!canEdit}
              onClick={() => void newDoc()}
            >
              ✚ {t("paper.newArticle")}
            </button>
            <button
              type="button"
              className={`bevel-thin-out bg-chrome px-2 py-[2px] text-[11px] press disabled:text-black/40 ${
                armDelete ? "text-[#a00000]" : ""
              }`}
              disabled={!selId || !canEdit}
              onClick={deleteDoc}
            >
              {armDelete === selId && selId ? t("paper.confirmDelete") : `🗑 ${t("paper.delete")}`}
            </button>
          </div>
          {phase !== "ready" ? (
            <p className="flex-1 flex items-center justify-center text-center text-[12px] text-black/40 whitespace-pre-line">
              {phase === "loading" ? t("paper.loadingShelf") : t("paper.offlineShelf")}
            </p>
          ) : docs.length === 0 ? (
            <p className="flex-1 flex items-center justify-center text-center text-[12px] text-black/40 whitespace-pre-line">
              {t("paper.emptyShelf")}
            </p>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto flex flex-wrap content-start gap-1">
              {docs.map((d) => (
                <div
                  key={d.id}
                  className={`w-[84px] flex flex-col items-center gap-1 p-1 cursor-default ${
                    selId === d.id ? "bg-navy text-white" : "text-black"
                  }`}
                  onPointerDown={() => setSelId(d.id)}
                  onDoubleClick={() => renameId !== d.id && openDoc(d.id)}
                  onContextMenu={(e) => {
                    setSelId(d.id);
                    menu.open(e, () => shelfMenu(d.id, live.current.armDelete === d.id));
                  }}
                >
                  <span className="relative inline-flex">
                    <PixelIcon sprite={MdDocIcon} size={32} />
                    {d.secret && <LockBadge />}
                  </span>
                  {renameId === d.id ? (
                    <input
                      value={renameVal}
                      spellCheck={false}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        // IME composition owns Enter until the candidate lands.
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) commitRename();
                        else if (e.key === "Escape") setRenameId(null);
                      }}
                      onBlur={commitRename}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full bevel-thin-in bg-white px-[2px] py-0 text-[11px] leading-tight text-black outline-none"
                    />
                  ) : (
                    <span className="text-[11px] text-center leading-tight break-all">{d.name}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeDoc && activeDoc.view === "edit" ? (
        <div className="flex-1 min-h-0 bg-white bevel-in">
          {editPane(activeDoc, "w-full h-full")}
        </div>
      ) : activeDoc && activeDoc.view === "preview" ? (
        <div className="flex-1 min-h-0 bg-chrome bevel-in">
          {previewPane(activeDoc, "w-full h-full")}
        </div>
      ) : (
        <div className="flex-1 min-h-0 bg-white bevel-in flex">
          {editPane(activeDoc!, "flex-1 min-w-0 h-full border-r border-[#808080]")}
          {previewPane(activeDoc!, "w-1/2 shrink-0")}
        </div>
      )}

      {/* Status bar */}
      {activeTab === SHELF ? (
        <StatusBar
          left={
            phase === "offline"
              ? t("paper.offline")
              : phase === "loading"
                ? "…"
                : `${t("paper.objectCount").replace("{count}", String(docs.length))}${selId ? t("paper.selected") : ""}`
          }
          right={
            phase === "ready"
              ? t("paper.totalChars").replace("{count}", docs.reduce((n, d) => n + (d.loaded ? countChars(d.body) : d.chars), 0).toLocaleString())
              : ""
          }
        />
      ) : activeDoc ? (
        <StatusBar
          left={
            activeDoc.view === "preview"
              ? t("paper.previewStatus").replace("{name}", activeDoc.name)
              : t("paper.caretStatus").replace("{line}", String(caret.ln)).replace("{col}", String(caret.col)).replace("{count}", countChars(activeDoc.body).toLocaleString()).replace("{saved}", savedLabel(activeDoc))
          }
          right={
            activeDoc.view === "preview"
              ? t("paper.pageStatus")
              : activeDoc.view === "split"
                ? t("paper.split")
                : "UTF-8"
          }
        />
      ) : (
        <StatusBar left=" " right="" />
      )}
    </div>
  );
}
