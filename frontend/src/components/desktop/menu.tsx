"use client";

import type { ReactNode } from "react";

/**
 * Handed to item actions. `reopen` swaps the menu's items in place (same
 * anchor) without closing — for two-step confirms whose label must change.
 * An action that reopens takes responsibility for the next state's items.
 */
export type MenuCtl = {
  reopen: (items: MenuItem[] | (() => MenuItem[])) => void;
};

/**
 * Shared menu item model for the global context menu (doc 04 §3). StartMenu is
 * scheduled to migrate onto this in a later pass; until then its local copy
 * stays untouched.
 */
export type MenuItem =
  | {
      kind: "item";
      label: ReactNode;
      icon?: ReactNode;
      /** Right-aligned accelerator hint, e.g. "F2" / "Ctrl+C". */
      hint?: string;
      disabled?: boolean;
      /** Destructive styling (dark red); hover and keyboard highlight still invert to white. */
      danger?: boolean;
      action?: (ctl: MenuCtl) => void;
      /** Flyout (CSS hover, StartMenu-style). The context menu currently ships flat menus only. */
      sub?: MenuItem[];
    }
  | { kind: "sep" };

type Item = Extract<MenuItem, { kind: "item" }>;

export function MenuRow({
  item,
  highlight,
  onPick,
}: {
  item: MenuItem;
  /** Keyboard-driven selection (arrow keys); mouse hover needs no prop. */
  highlight?: boolean;
  onPick: (item: Item) => void;
}) {
  if (item.kind === "sep") {
    return <li className="my-[3px] mx-[2px] h-[2px] bevel-thin-in" aria-hidden />;
  }
  const it = item;
  const tone = it.disabled
    ? "text-black/40"
    : highlight
      ? "bg-navy text-white"
      : `enabled:hover:bg-navy enabled:hover:text-white${it.danger ? " text-[#a00000]" : ""}`;
  return (
    <li role="presentation" className="relative group/menu">
      <button
        type="button"
        role="menuitem"
        aria-disabled={it.disabled}
        disabled={it.disabled}
        onClick={() => onPick(it)}
        className={`w-full flex items-center gap-2 px-2 py-[5px] text-left whitespace-nowrap ${tone}`}
      >
        {it.icon && <span className="shrink-0 flex items-center">{it.icon}</span>}
        <span className="flex-1 text-[13px]">{it.label}</span>
        {it.hint && (
          <span className={`shrink-0 text-[11px] ${highlight ? "text-white/70" : "text-black/50"}`}>
            {it.hint}
          </span>
        )}
        {it.sub && <span className="text-[10px] shrink-0">▶</span>}
      </button>
      {it.sub && (
        <ul className="absolute left-full top-[-3px] z-10 min-w-[190px] bg-chrome bevel-out p-[3px] hidden group-hover/menu:block">
          {it.sub.map((s, i) => (
            <MenuRow key={i} item={s} highlight={false} onPick={onPick} />
          ))}
        </ul>
      )}
    </li>
  );
}
