"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LANG_COOKIE, isLang, t, type DictKey, type Lang } from "./dict";

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a dictionary key into the active language. */
  t: (key: DictKey) => string;
};

const I18nContext = createContext<I18n | null>(null);

function readCookieLang(): Lang {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/(?:^|;\s*)nb-lang=([^;]+)/);
  return m && isLang(m[1]) ? m[1] : "en";
}

export function LanguageProvider({
  initialLang,
  children,
}: {
  initialLang?: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? readCookieLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof document !== "undefined") {
      // 1y, SameSite=Lax; no server round-trip needed — pure UI preference.
      document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    }
  }, []);

  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key) => t(lang, key) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}
