import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource/vt323";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/700.css";
// Desk-text title mode (DeskTexts.tsx): Pixelify covers Latin, Fusion Pixel
// (single 600KB face, loads lazily on first title use) covers simplified hanzi.
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/fusion-pixel-12px-proportional-sc/400.css";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { isLang } from "@/lib/i18n/dict";

export const metadata: Metadata = {
  title: {
    default: "NewBoy's Computer",
    template: "%s · NewBoy",
  },
  description:
    "NewBoy — Toolsmith Services Terminal. Est. 2026. Best viewed at 800×600.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const jar = await cookies();
  const raw = jar.get("nb-lang")?.value;
  const lang = isLang(raw) ? raw : "en";

  return (
    <html lang={lang === "en" ? "en" : "zh-CN"} className="h-full antialiased">
      <body className="min-h-full bg-black">
        <LanguageProvider initialLang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
