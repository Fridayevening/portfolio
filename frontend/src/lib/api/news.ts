// news transport: one-shot JSON fetch for the desktop newspaper card.
// The server caches and refreshes on its own cron — the client only re-polls
// slowly (see Ledger), so a plain apiFetch per call is all there is to it.

import { apiFetch } from "./client";
import type { NewsTodayResponse } from "./types";

export function getNewsToday(
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<NewsTodayResponse> {
  return apiFetch<NewsTodayResponse>("/v1/news/today", opts);
}
