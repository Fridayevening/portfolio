"use client";

// Boot POST sequence — placeholder skeleton for now, gated by Desktop's BOOT_ENABLED flag.
// The full version (line-by-line BIOS text, memory count, logo flash) is future work; the
// onDone() contract is final: it fires on skip and on completion alike.

import { useEffect } from "react";
import { useI18n } from "../../lib/i18n/LanguageContext";

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[1001] bg-black text-phosphor text-glow font-display text-[22px] leading-snug p-8 select-none"
      onClick={onDone}
      role="button"
      tabIndex={0}
      aria-label={t("boot.skipAria")}
    >
      <p>NewBoy SYSTEMS BIOS v2.26</p>
      <p className="mt-2 opacity-80">{t("boot.memory")}</p>
      <p className="opacity-80">{t("boot.crt")}</p>
      <p className="opacity-80">{t("boot.humor")}</p>
      <p className="mt-6 cursor-blink">{t("boot.pressAny")}</p>
    </div>
  );
}
