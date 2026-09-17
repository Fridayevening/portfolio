// Market feed singleton — the dual-engine switchboard of docs/02 §5.
//
//   live   (backend reachable)  → SSE /v1/market/stream drives alerts; the local
//                                fake engine is powered down.
//   local  (probe failed / SSE down / offline build) → local-engine theatre takes
//                                over so the desktop never goes quiet.
//
// The SSE connection stays up regardless of mode — its own backoff/reconnect makes
// it the revival detector (faster than mode.ts's 90 s slow probe). Connection-state
// flips flow through conn.markLive/markLocal (the hooks mode.ts reserved for us).

import { getApiBaseUrl } from "@/lib/api/client";
import { conn } from "@/lib/api/mode";
import { createSseConnection, type SseConnection } from "@/lib/api/sse";
import type { AlertPayload, Quote } from "@/lib/api/types";
import { createLocalEngine, type LocalEngine } from "./local-engine";

const TICK_MS = 2000;
const FIRST_ALERT_MS = 2600;
const ALERT_MIN_MS = 10_400;
const ALERT_JITTER_MS = 3_600;
/** Breathing room between queued alerts once a toast retires. */
const QUEUE_GAP_MS = 900;
/** Mirrors the server's sparkline window. */
const HIST_MAX = 40;

export type MarketAlertHandler = (a: AlertPayload) => void;
export type MarketQuotesHandler = (quotes: Quote[]) => void;

class MarketFeed {
  private handlers = new Set<MarketAlertHandler>();
  private quoteHandlers = new Set<MarketQuotesHandler>();
  private started = false;
  private sse: SseConnection | null = null;
  private unsubscribeConn: (() => void) | null = null;
  // Local engine state; lastId lives outside the engine so symbol rotation
  // survives engine restarts across mode flips.
  private lastId: { current: string | null } = { current: null };
  private engine: LocalEngine | null = null;
  private walkTimer: ReturnType<typeof setInterval> | null = null;
  private directorTimer: ReturnType<typeof setTimeout> | null = null;
  /** Full quote table: server order in live mode, SYMS order in local mode. */
  private quotes = new Map<string, Quote>();

  subscribe(handler: MarketAlertHandler): () => void {
    this.handlers.add(handler);
    this.ensureStarted();
    return () => {
      this.handlers.delete(handler);
      this.maybeTeardown();
    };
  }

  /** Full quote table for the market window (live feed or local walk). */
  subscribeQuotes(handler: MarketQuotesHandler): () => void {
    this.quoteHandlers.add(handler);
    this.ensureStarted();
    // Late subscribers get the current table immediately.
    if (this.quotes.size > 0) handler(this.snapshotQuotes());
    return () => {
      this.quoteHandlers.delete(handler);
      this.maybeTeardown();
    };
  }

  private snapshotQuotes(): Quote[] {
    return [...this.quotes.values()];
  }

  private notifyQuotes(): void {
    const qs = this.snapshotQuotes();
    for (const h of this.quoteHandlers) h(qs);
  }

  private maybeTeardown(): void {
    if (this.handlers.size === 0 && this.quoteHandlers.size === 0) this.teardown();
  }

  private ensureStarted(): void {
    if (this.started) return;
    this.started = true;

    if (getApiBaseUrl()) {
      this.sse = createSseConnection(
        getApiBaseUrl() + "/v1/market/stream",
        {
          onOpen: () => conn.markLive(),
          onEvent: (type, data) => {
            if (type === "alert") {
              const alert = (data as { alert?: AlertPayload }).alert;
              if (alert) this.dispatch(alert);
            } else if (type === "snapshot") {
              const { quotes } = data as { quotes?: Quote[] };
              if (quotes) {
                this.quotes = new Map(quotes.map((q) => [q.id, q]));
                this.notifyQuotes();
              }
            } else if (type === "tick") {
              const { quotes } = data as { quotes?: { id: string; price: number }[] };
              if (quotes) {
                for (const t of quotes) {
                  const q = this.quotes.get(t.id);
                  if (!q) continue;
                  const hist = q.price === t.price ? q.hist : [...q.hist, t.price];
                  this.quotes.set(t.id, { ...q, price: t.price, hist: hist.length > HIST_MAX ? hist.slice(-HIST_MAX) : hist });
                }
                this.notifyQuotes();
              }
            }
          },
          onDown: () => conn.markLocal(),
        },
        { eventTypes: ["snapshot", "tick", "alert"] },
      );
    }
    // Also in offline builds (no baseUrl): subscribing drives conn to "local",
    // which starts the fake engine via syncEngines below.
    this.unsubscribeConn = conn.subscribe(() => this.syncEngines());
    this.syncEngines();
  }

  private teardown(): void {
    this.stopLocalEngine();
    this.sse?.close();
    this.sse = null;
    this.unsubscribeConn?.();
    this.unsubscribeConn = null;
    this.quotes.clear();
    this.started = false;
  }

  private syncEngines(): void {
    if (conn.get().status === "live") this.stopLocalEngine();
    else this.startLocalEngine();
  }

  private startLocalEngine(): void {
    if (this.walkTimer) return; // already running (probing → local etc.)
    this.engine ??= createLocalEngine(this.lastId);
    // Each walk also refreshes the quote table (the window's offline data).
    this.walkTimer = setInterval(() => {
      this.engine?.walk();
      if (this.engine) {
        this.quotes = new Map(this.engine.quotes().map((q) => [q.id, q]));
        this.notifyQuotes();
      }
    }, TICK_MS);
    const direct = (delay: number) => {
      this.directorTimer = setTimeout(() => {
        if (!this.engine) return;
        this.dispatch(this.engine.nextAlert());
        direct(ALERT_MIN_MS + Math.random() * ALERT_JITTER_MS);
      }, delay);
    };
    // During "probing" the fake engine starts immediately; if the probe then says
    // live, syncEngines stops it — at most one fake toast slips out, which just
    // plays out its 8 s life.
    direct(FIRST_ALERT_MS);
  }

  private stopLocalEngine(): void {
    if (this.walkTimer) clearInterval(this.walkTimer);
    this.walkTimer = null;
    if (this.directorTimer) clearTimeout(this.directorTimer);
    this.directorTimer = null;
    this.engine = null;
  }

  private dispatch(alert: AlertPayload): void {
    for (const h of this.handlers) h(alert);
  }
}

const feed = new MarketFeed();

/** Subscribe to market alerts (real feed when live, local theatre otherwise). */
export function subscribeMarketAlerts(handler: MarketAlertHandler): () => void {
  return feed.subscribe(handler);
}

/** Subscribe to the full quote table (server SSE when live, local walk otherwise). */
export function subscribeMarketQuotes(handler: MarketQuotesHandler): () => void {
  return feed.subscribeQuotes(handler);
}
