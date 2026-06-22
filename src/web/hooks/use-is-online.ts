import { useSyncExternalStore } from "react";

/**
 * Shared online/offline state for the whole app.
 *
 * `navigator.onLine` alone is not enough: it reports `true` on a network that has
 * no actual internet (and under DevTools' service-worker "offline" toggle), so a
 * fresh load while effectively offline would never show the offline UI. So we also
 * actively verify reachability of our own origin.
 *
 * `navigator.onLine === false` is trusted immediately (definitely offline);
 * `=== true` is verified with a single same-origin probe. The probe hits an
 * unknown, non-`/api`, non-precached path: the service worker has no route for it
 * (and no catch-all), so it falls through to the network — resolving (edge
 * SPA-fallback) when truly online and rejecting when offline. A precached asset
 * would be wrong here: the SW would serve it from cache offline and report "online".
 *
 * One shared store + one probe on load/events, not a probe per component mount
 * (the old `is-online` package pinged third-party hosts on every mount).
 */
let online = typeof navigator !== "undefined" ? navigator.onLine : true;
const listeners = new Set<() => void>();

// While offline we poll, because regaining connectivity does NOT reliably fire an
// `online` event: if `navigator.onLine` never dropped to false (connected but no
// internet, or DevTools' SW-offline toggle), the browser thinks it was online the
// whole time; and on some systems `navigator.onLine` is simply stuck/unreliable.
// In all those cases nothing re-triggers a probe and the app stays stuck offline
// until a manual reload. The poll calls `probe()` directly (NOT `verify()`), so it
// hits the network even while `navigator.onLine` claims offline — that real fetch
// is the only thing that can actually detect recovery.
const OFFLINE_POLL_MS = 15_000;
// Bound each probe: on a captive portal or a hung socket the fetch can stall for a
// long time, and while one is in flight every poll tick is skipped (`probing`),
// which would wedge recovery detection. Abort so a stuck request reads as offline.
const PROBE_TIMEOUT_MS = 8_000;
let pollTimer: ReturnType<typeof setInterval> | undefined;

function setOnline(next: boolean) {
  if (next !== online) {
    online = next;
    for (const l of listeners) l();
  }
  // Poll only while offline; stop as soon as we recover.
  if (typeof window === "undefined") return;
  if (!online && pollTimer === undefined) {
    pollTimer = setInterval(() => void probe(), OFFLINE_POLL_MS);
  } else if (online && pollTimer !== undefined) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

let probing = false;
// Actually hit the network and update state from the result. Intentionally does
// NOT consult `navigator.onLine` — callers that want the fast offline path use
// `verify()`; the poll calls this directly so it can recover from a stuck onLine.
async function probe() {
  if (probing) return;
  probing = true;
  try {
    // Any resolved response (even 4xx/5xx) means the server is reachable. The
    // query string defeats the HTTP cache; HEAD keeps it tiny.
    await fetch(`/__online_check?_=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    setOnline(true);
  } catch {
    setOnline(false);
  } finally {
    probing = false;
  }
}

// Fast path for events/startup: a hard `navigator.onLine === false` is trusted
// immediately (definitely offline); otherwise confirm with a real probe.
function verify() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    setOnline(false);
    return;
  }
  void probe();
}

if (typeof window !== "undefined") {
  // Trust the offline event immediately; verify a regained connection.
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("online", () => verify());
  // Re-check when the tab is refocused, to recover from silent drops/restores.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") verify();
  });
  // Verify once at startup so a reload while (silently) offline is detected.
  verify();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

const getSnapshot = () => online;
// SSR / prerender: assume online so nothing renders disabled on the server (the
// client re-evaluates immediately on hydration).
const getServerSnapshot = () => true;

/**
 * Non-hook accessor for the shared online state, for route loaders and other
 * non-React code. Probe-aware, unlike raw `navigator.onLine` (which reports `true`
 * on a network with no real internet). SSR-safe: defaults to `true` on the server.
 */
export function getIsOnline() {
  return online;
}

export function useIsOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
