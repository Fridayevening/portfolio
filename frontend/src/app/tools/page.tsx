import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { isLang, t } from "@/lib/i18n/dict";

async function pageLang() {
  const value = (await cookies()).get("nb-lang")?.value;
  return isLang(value) ? value : "zh";
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: t(await pageLang(), "toolsPage.title") };
}

export default async function ToolsPage() {
  const lang = await pageLang();
  return (
    <div className="min-h-screen bg-black text-phosphor font-mono p-6 sm:p-10">
      <p className="font-display text-[30px] leading-none text-glow">
        TOOLSMITH SERVICES TERMINAL
      </p>
      <p className="mt-2 text-[12px] text-phosphor/60">
        EST. 2026 · NewBoy World, INC
      </p>
      <pre className="mt-8 text-[13px] leading-[1.8] text-glow">
{`C:\\NewBoy> dir tools
${t(lang, "toolsPage.dir")}

  ${t(lang, "toolsPage.empty")}

C:\\NewBoy> _`}
      </pre>
      <Link
        href="/"
        className="inline-block mt-8 text-[13px] text-phosphor underline hover:bg-phosphor hover:text-black"
      >
        {t(lang, "toolsPage.back")}
      </Link>
    </div>
  );
}
