import { ErrorComponent, Link } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import { clearPersistedCache } from "src/lib/query-client";
import { Button } from "./ui/button";
import { RotateCcw, House, RefreshCcw } from "lucide-react";

export const clearCacheAndReload = async () => {
  try {
    // The persisted query snapshot (IndexedDB) is the likeliest poison — clear
    // it first, before anything below can fail.
    await clearPersistedCache();

    // Clear local cache (e.g., localStorage, sessionStorage)
    localStorage.clear();
    sessionStorage.clear();

    // Clear Service Worker cache
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    // Clear browser cache
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (err) {
    console.error("Failed to clear cache:", err);
  } finally {
    // Reload even if some clearing step failed — a partial clear plus a fresh
    // load still beats staying on the error page.
    window.location.reload();
  }
};

// Remembers, per error message, whether a plain reload was already tried for it -
// keyed by message so a different, later error isn't stuck disabled because of an
// older one. sessionStorage because it must survive the reload itself.
const RELOAD_ATTEMPTED_KEY = "customError:reloadAttemptedFor";

export function CustomError({ error }: ErrorComponentProps) {
  const [reloadDidntHelp] = useState(
    () => sessionStorage.getItem(RELOAD_ATTEMPTED_KEY) === error.message,
  );

  console.error("CustomError Error:", error);

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Upsík dupsík!</h1>
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant="outline"
          disabled={reloadDidntHelp}
          title={reloadDidntHelp ? "Already tried - try a hard reload instead" : undefined}
          onClick={() => {
            sessionStorage.setItem(RELOAD_ATTEMPTED_KEY, error.message);
            // A real reload, not router.invalidate(): the most common error here
            // is a lazy chunk that vanished after a deploy, which only a fresh
            // document (served by the updated service worker) can fix.
            window.location.reload();
          }}
        >
          <RefreshCcw />
          Reload
        </Button>
        <Button variant="outline" onClick={clearCacheAndReload}>
          <RotateCcw />
          Hard reload
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">
            <House />
            Go home
          </Link>
        </Button>
      </div>
      {reloadDidntHelp && (
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          A plain reload didn't fix it. Try the hard reload. Note that this will delete any settings on your device and will redownload the whole database (a few MB). :-(
        </p>
      )}
    </div>
  );
}
