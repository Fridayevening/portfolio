import { cookies } from "next/headers";
import Desktop from "@/components/desktop/Desktop";
import { PREFS_COOKIE, bootPrefsFromCookieValue } from "@/lib/prefs";

// Reading the cookie opts the route into dynamic rendering — the price of
// painting the user's ui prefs and icon layout on frame one instead of
// flashing the defaults.
export default async function Home() {
  const jar = await cookies();
  return <Desktop boot={bootPrefsFromCookieValue(jar.get(PREFS_COOKIE)?.value)} />;
}
