"use client";

import { useDesktop } from "./context";
import { FolderView, MenuBar, StatusBar } from "./windows";
import { MdDocIcon, PixelIcon } from "./icons";
import { useI18n } from "../../lib/i18n/LanguageContext";
import { local, RESEARCH_ENTRIES, WORK_ENTRIES, type PortfolioEntry } from "./portfolioContent";

function PortfolioFolder({ kind }: { kind: "work" | "research" }) {
  const api = useDesktop();
  const { lang, t } = useI18n();
  const entries = kind === "work" ? WORK_ENTRIES : RESEARCH_ENTRIES;

  return (
    <FolderView
      items={entries.map((entry) => ({
        id: entry.id,
        label: local(entry.title, lang),
        icon: <PixelIcon sprite={MdDocIcon} size={32} />,
        onOpen: () => {
          const width = Math.min(820, window.innerWidth - 24);
          const height = Math.min(650, window.innerHeight - 60);
          const preferredX = kind === "work" ? 220 : 300;
          const preferredY = kind === "work" ? 70 : 100;
          api.openDef({
            id: `portfolio-${entry.id}`,
            title: local(entry.title, lang),
            titleByLang: entry.title,
            icon: <PixelIcon sprite={MdDocIcon} size={14} />,
            w: width,
            h: height,
            x: Math.min(preferredX, Math.max(0, window.innerWidth - width - 8)),
            y: Math.min(preferredY, Math.max(0, window.innerHeight - height - 44)),
            render: () => <PortfolioReader entry={entry} />,
          });
        },
      }))}
      countLabel={`${entries.length} ${t("status.items")}`}
    />
  );
}

export function WorkFolderWindow() {
  return <PortfolioFolder kind="work" />;
}

export function ResearchFolderWindow() {
  return <PortfolioFolder kind="research" />;
}

function PortfolioReader({ entry }: { entry: PortfolioEntry }) {
  const { lang, t } = useI18n();
  const kindLabel = t(entry.kind === "work" ? "portfolio.work.title" : "portfolio.research.title");
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <MenuBar items={[t("menu.file"), t("menu.view"), t("menu.help")]} right={kindLabel} />
      <article className="flex-1 min-h-0 overflow-auto bg-[#f4f1e4] bevel-in px-5 py-4 text-[13px] leading-[1.65] text-[#191919]">
        <header className="border-b-2 border-black pb-3 mb-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-black/60 mb-1">{kindLabel}</p>
          <h1 className="font-bold text-[22px] leading-tight">{local(entry.title, lang)}</h1>
          <p className="mt-2 text-[13px] text-black/70">{local(entry.subtitle, lang)}</p>
        </header>

        {entry.metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 border-l border-t border-black mb-5">
            {entry.metrics.map((metric) => (
              <div key={`${entry.id}-${metric.value}-${metric.label.en}`} className="border-r border-b border-black p-2 bg-white/45">
                <strong className="block text-[18px]">{metric.value}</strong>
                <span className="text-[10px] leading-tight block">{local(metric.label, lang)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-5">
          {entry.sections.map((section) => (
            <section key={section.heading.en}>
              <h2 className="font-bold text-[15px] border-b border-black/30 mb-2 pb-1">{local(section.heading, lang)}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph.en} className="mb-2">{local(paragraph, lang)}</p>)}
              {section.items && (
                <ul className="list-disc pl-5 space-y-1">
                  {section.items.map((item) => <li key={item.en}>{local(item, lang)}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        {entry.prototypeUrl && (
          <p className="mt-6 pt-3 border-t border-black/30">
            <a className="text-navy underline font-bold" href={entry.prototypeUrl} target="_blank" rel="noreferrer">
              {t("portfolio.prototype")}
            </a>
          </p>
        )}
      </article>
      <StatusBar left={local(entry.title, lang)} right={lang === "en" ? "English" : "中文"} />
    </div>
  );
}
