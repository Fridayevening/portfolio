"use client";

import { useI18n } from "../../lib/i18n/LanguageContext";

export default function ShutdownScreen({ onRestart }: { onRestart: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center gap-8 select-none"
      onClick={onRestart}
      role="button"
      tabIndex={0}
      aria-label={t("shutdown.aria")}
    >
      <p className="font-display text-[42px] leading-[1.3] text-center text-amber amber-glow max-w-[16em]">
        It&apos;s now safe to turn off
        <br />
        your computer.
      </p>
      <p className="text-[13px] text-phosphor/60 font-mono">{t("shutdown.note")}</p>
    </div>
  );
}
