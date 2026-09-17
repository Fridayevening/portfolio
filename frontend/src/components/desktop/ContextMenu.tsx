"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MenuRow, type MenuCtl, type MenuItem } from "./menu";
import { useI18n } from "../../lib/i18n/LanguageContext";

type Item = Extract<MenuItem, { kind: "item" }>;
type ItemsSource = MenuItem[] | (() => MenuItem[]);

type MenuApi = {
  /** Suppress the native menu, stop propagation, open at the cursor. */
  open: (
    e: { preventDefault(): void; stopPropagation(): void; clientX: number; clientY: number },
    items: ItemsSource
  ) => void;
  /** Open without a mouse event (touch long-press, Menu key). */
  openAt: (x: number, y: number, items: ItemsSource) => void;
  close: () => void;
};

// The taskbar keeps the last 36px of the viewport; the menu must flip above it.
const TASKBAR_H = 36;
const EDGE = 2;
// Over Taskbar/StartMenu/Paperclip (850/860/865), under Shutdown/Boot (1000+).
const MENU_Z = "z-[900]";

const MenuContext = createContext<MenuApi | null>(null);

export function useContextMenu(): MenuApi {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useContextMenu must be used inside MenuProvider");
  return ctx;
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  // items is stored as a factory and evaluated per render; openers must read
  // reactive state through refs inside it, never through the open-time closure
  // (doc 04 铁律 4).
  const [menu, setMenu] = useState<{ x: number; y: number; items: () => MenuItem[] } | null>(null);
  // Null = not yet placed; the menu renders hidden at (0,0) until measured.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hi, setHi] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const openAt = useCallback((x: number, y: number, items: ItemsSource) => {
    setMenu({ x, y, items: typeof items === "function" ? items : () => items });
    setPos(null);
    setHi(-1);
  }, []);

  const open = useCallback<MenuApi["open"]>(
    (e, items) => {
      e.preventDefault();
      e.stopPropagation();
      openAt(e.clientX, e.clientY, items);
    },
    [openAt]
  );

  const close = useCallback(() => setMenu(null), []);

  // Site-wide suppression (doc 04 §4.2): an unclaimed right-click still never
  // shows the browser menu. Alt+right-click is the dev escape hatch.
  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      if (e.defaultPrevented || e.altKey) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, []);

  // Measure-then-place: never guess the menu size (the lesson from the shelf's
  // hand-rolled clamp). Flip left / up when the cursor-anchored box would cross
  // the viewport edge or the taskbar.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let { x, y } = menu;
    if (x + r.width > window.innerWidth - EDGE) x = Math.max(EDGE, menu.x - r.width);
    if (y + r.height > window.innerHeight - TASKBAR_H - EDGE) y = Math.max(EDGE, menu.y - r.height);
    setPos({ x, y });
  }, [menu]);

  const pick = useCallback(
    (it: Item) => {
      if (it.disabled || it.sub) return;
      // reopen keeps the anchor; the menu re-measures and re-places pre-paint.
      let reopened = false;
      const ctl: MenuCtl = {
        reopen: (items) => {
          reopened = true;
          if (menu) openAt(menu.x, menu.y, items);
        },
      };
      it.action?.(ctl);
      if (!reopened) close();
    },
    [menu, close, openAt]
  );

  // Dismissal + keyboard nav, armed only while a menu is open. Document-level
  // listeners keep the menu from stealing focus off the underlying window.
  useEffect(() => {
    if (!menu) return;
    const inside = (t: EventTarget | null) => t instanceof Node && !!ref.current?.contains(t);
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      // Win95 semantics: nothing highlighted on open; arrows wrap; separators,
      // disabled and flyout items are skipped.
      const pickables = menu
        .items()
        .map((it, i) => (it.kind === "item" && !it.disabled && !it.sub ? i : -1))
        .filter((i) => i >= 0);
      if (!pickables.length) return;
      const at = pickables.indexOf(hi);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHi(at < 0 ? pickables[0] : pickables[(at + 1) % pickables.length]);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHi(at < 0 ? pickables[pickables.length - 1] : pickables[(at - 1 + pickables.length) % pickables.length]);
      } else if (e.key === "Enter" || e.key === " ") {
        const it = menu.items()[hi];
        if (it && it.kind === "item" && !it.disabled && !it.sub) {
          e.preventDefault();
          pick(it);
        }
      }
    };
    const onBlur = () => close();
    const onVis = () => document.hidden && close();
    const onWheel = () => close();
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("wheel", onWheel);
    };
  }, [menu, hi, close, pick]);

  const api = useMemo<MenuApi>(() => ({ open, openAt, close }), [open, openAt, close]);

  return (
    <MenuContext.Provider value={api}>
      {children}
      {menu &&
        createPortal(
          <div
            ref={ref}
            role="menu"
            aria-label={t("common.contextMenu")}
            className={`fixed ${MENU_Z} min-w-[160px] bg-chrome bevel-out p-[3px]`}
            style={pos ? { left: pos.x, top: pos.y } : { left: 0, top: 0, visibility: "hidden" }}
          >
            <ul>
              {menu.items().map((it, i) => (
                <MenuRow key={i} item={it} highlight={i === hi} onPick={pick} />
              ))}
            </ul>
          </div>,
          document.body
        )}
    </MenuContext.Provider>
  );
}
