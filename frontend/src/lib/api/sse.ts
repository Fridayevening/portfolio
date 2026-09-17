// SSE transport: connect, reconnect with backoff, drop notification.
// On a dropped connection EventSource retries forever on its own (CONNECTING state);
// we only rebuild manually with backoff once the browser gives up (CLOSED, e.g. 4xx/
// 5xx). In both cases, staying down past the grace period calls onDown and the caller
// decides how to degrade. Reconnects are unlimited — revival is automatic, so there is
// no "give up and try something else" branch.

export interface SseHandlers {
  onOpen: () => void;
  onEvent: (type: string, data: unknown) => void;
  onDown: () => void;
}

export interface SseConnection {
  close: () => void;
}

/** Backoff sequence for manual rebuilds; once exhausted, keeps retrying at the last
 *  interval. */
const DEFAULT_BACKOFF_MS = [1000, 2000, 4000];
/** How long a drop counts as "really down" before the caller is told to degrade. */
const OPEN_GRACE_MS = 5000;

export function createSseConnection(
  url: string,
  handlers: SseHandlers,
  opts: { eventTypes: string[]; backoffMs?: number[] },
): SseConnection {
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  let es: EventSource | null = null;
  let attempt = 0;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearGrace = () => {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
  };
  const armGrace = () => {
    // Don't reset a running grace timer: grace measures "how long since the last
    // OPEN", not "since the last error" — otherwise the browser's ~3 s automatic
    // retries would keep renewing it and degradation would starve forever.
    if (graceTimer) return;
    graceTimer = setTimeout(() => {
      if (!closed && es?.readyState !== EventSource.OPEN) handlers.onDown();
    }, OPEN_GRACE_MS);
  };

  const connect = () => {
    es = new EventSource(url);
    es.onopen = () => {
      attempt = 0;
      clearGrace();
      handlers.onOpen();
    };
    es.onerror = () => {
      if (closed || !es) return;
      if (es.readyState === EventSource.CONNECTING) {
        // The browser is self-healing; stay out of it — degrade only if it doesn't
        // reconnect within the grace period.
        armGrace();
        return;
      }
      // CLOSED: the browser gave up (usually non-2xx) — rebuild manually with backoff.
      es.close();
      es = null;
      handlers.onDown();
      const wait = backoffMs[Math.min(attempt++, backoffMs.length - 1)];
      retryTimer = setTimeout(() => {
        if (!closed) connect();
      }, wait);
    };
    for (const type of opts.eventTypes) {
      es.addEventListener(type, (ev) => {
        const raw = (ev as MessageEvent).data;
        try {
          handlers.onEvent(type, typeof raw === "string" ? JSON.parse(raw) : raw);
        } catch {
          // Drop bad frames; the connection lives on.
        }
      });
    }
  };

  connect();

  return {
    close() {
      closed = true;
      clearGrace();
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      es = null;
    },
  };
}
