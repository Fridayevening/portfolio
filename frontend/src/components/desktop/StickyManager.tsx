"use client";

// Sticky Notes Manager (STICKIES.EXE): an index over the desk's paper scraps. The scraps
// themselves live on the surface layer (StickyNotes); this window only reads
// the same store and offers herd verbs — search, locate, fold/unfold, delete —
// plus a spawn button for when the right-click menu feels far away.

import { useMemo, useState } from "react";
import { MenuBar, StatusBar } from "./windows";
import {
  PAPERS,
  addStickyNote,
  flashNote,
  parseStickyText,
  removeStickyNote,
  splitTodoTime,
  stickyTitle,
  toggleStickyFold,
  useStickyNotes,
  type StickyNoteData,
} from "./stickyState";
import { useI18n } from "../../lib/i18n/LanguageContext";

/** First pending todo, else the first non-title paragraph — the preview line. */
function preview(note: StickyNoteData): string {
  const lines = parseStickyText(note.text);
  for (const l of lines) {
    if (l.kind === "todo" && !l.done) return l.text.trim();
  }
  for (const l of lines) {
    if (l.kind === "para" && !l.title && l.text.trim()) return l.text.trim();
  }
  return "";
}

/** Earliest-armed reminder text on the note, or null. */
function armedTime(note: StickyNoteData): string | null {
  for (const l of parseStickyText(note.text)) {
    if (l.kind === "todo" && !l.done) {
      const t = splitTodoTime(l.text);
      if (t) return t.at;
    }
  }
  return null;
}

export default function StickyManager() {
  const { t } = useI18n();
  const notes = useStickyNotes();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes.filter((n) => !needle || n.text.toLowerCase().includes(needle));
  }, [notes, q]);

  const pending = useMemo(
    () =>
      notes.reduce(
        (acc, n) => acc + parseStickyText(n.text).filter((l) => l.kind === "todo" && !l.done).length,
        0,
      ),
    [notes],
  );

  // Locate without z-order games: unfold the scrap so its content is back, then
  // blink its frame on the desk.
  const locate = (n: StickyNoteData) => {
    toggleStickyFold(n.id, false);
    flashNote(n.id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-[3px]">
      <MenuBar items={[t("imglab.menu.file"), t("imglab.menu.view"), t("imglab.menu.help")]} right="STICKIES v1.0" />
      <div className="flex shrink-0 items-center gap-[6px] px-[2px]">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          placeholder={t("stickies.search")}
          aria-label={t("stickies.search")}
          className="min-w-0 flex-1 bg-white bevel-thin-in px-[6px] py-[2px] text-[12px] outline-none placeholder:text-black/40"
        />
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-3 py-[2px] text-[12px] press"
          onClick={() => addStickyNote(window.innerWidth / 2 - 130, window.innerHeight / 2 - 140, t("sticky.default"))}
        >
          {t("stickies.new")}
        </button>
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-3 py-[2px] text-[12px] press"
          onClick={() => notes.forEach((n) => toggleStickyFold(n.id, true))}
        >
          {t("stickies.foldAll")}
        </button>
        <button
          type="button"
          className="bevel-thin-out bg-chrome px-3 py-[2px] text-[12px] press"
          onClick={() => notes.forEach((n) => toggleStickyFold(n.id, false))}
        >
          {t("stickies.expandAll")}
        </button>
      </div>
      <div className="flex-1 min-h-0 bg-white bevel-in overflow-auto">
        {rows.length === 0 ? (
          <p className="p-3 text-[12px] leading-[1.7] text-black/50">
            {notes.length === 0
              ? t("stickies.empty")
              : t("stickies.noMatch")}
          </p>
        ) : (
          rows.map((n) => {
            const todos = parseStickyText(n.text).filter((l) => l.kind === "todo");
            const done = todos.filter((l) => l.kind === "todo" && l.done).length;
            const at = armedTime(n);
            const sw = PAPERS[n.color] ?? PAPERS[0];
            const selected = sel === n.id;
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                className={`group flex cursor-default items-center gap-[8px] px-[8px] py-[4px] text-[12px] outline-none focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black ${
                  selected ? "bg-navy text-white" : "text-black"
                }`}
                onClick={() => setSel(n.id)}
                onDoubleClick={() => locate(n)}
                onKeyDown={(e) => e.key === "Enter" && locate(n)}
              >
                <span
                  className="h-[12px] w-[12px] shrink-0"
                  style={{ background: sw.paper, boxShadow: `0 0 0 1px ${sw.frame}` }}
                />
                <span className="min-w-0 flex-1 leading-[1.45]">
                  <span className={`block truncate font-bold ${selected ? "" : "text-[#1f1d17]"}`}>
                    {stickyTitle(n.text, t("sticky.title"))}
                    {n.folded && <span className={`ml-[6px] font-normal text-[10px] ${selected ? "text-white/70" : "text-black/50"}`}>{t("stickies.folded")}</span>}
                  </span>
                  <span className={`block truncate text-[11px] ${selected ? "text-white/75" : "text-black/55"}`}>
                    {preview(n) || "…"}
                  </span>
                </span>
                {todos.length > 0 && (
                  <span className={`shrink-0 text-[11px] ${selected ? "text-white/85" : "text-black/60"}`}>
                    {done}/{todos.length}
                  </span>
                )}
                {at && (
                  <span className={`shrink-0 text-[11px] font-bold ${selected ? "text-white" : "text-[#8a2010]"}`}>
                    @{at}
                  </span>
                )}
                <span className="flex shrink-0 gap-[4px] opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    className="bevel-thin-out bg-chrome px-[6px] py-[1px] text-[11px] press"
                    onClick={(e) => {
                      e.stopPropagation();
                      locate(n);
                    }}
                  >
                    {t("stickies.locate")}
                  </button>
                  <button
                    type="button"
                    className="bevel-thin-out bg-chrome px-[6px] py-[1px] text-[11px] press"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStickyFold(n.id);
                    }}
                  >
                    {n.folded ? t("sticky.expand") : t("stickies.collapse")}
                  </button>
                  <button
                    type="button"
                    className="bevel-thin-out bg-chrome px-[6px] py-[1px] text-[11px] press text-[#a00000]"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStickyNote(n.id);
                    }}
                  >
                    {t("stickies.delete")}
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
      <StatusBar
        left={`${t("stickies.status").replace("{notes}", String(notes.length)).replace("{pending}", String(pending))}${q.trim() ? t("stickies.filter").replace("{query}", q.trim()).replace("{count}", String(rows.length)) : ""}`}
        right={t("stickies.index")}
      />
    </div>
  );
}
