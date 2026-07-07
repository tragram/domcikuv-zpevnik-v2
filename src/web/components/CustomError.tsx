import { ErrorComponent, Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "./ui/button";
import { RotateCcw, House, RefreshCcw } from "lucide-react";

export const clearCacheAndReload = async () => {
  try {
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

    // Reload the page
    window.location.reload();
  } catch (err) {
    console.error("Failed to clear cache:", err);
  }
};

// Remembers, per error message, whether a plain reload was already tried for it -
// keyed by message so a different, later error isn't stuck disabled because of an
// older one. A route error re-invalidate remounts the error boundary rather than
// re-rendering in place, so this can't live in component state; sessionStorage
// survives that remount.
const RELOAD_ATTEMPTED_KEY = "customError:reloadAttemptedFor";

export function CustomError({ error }: ErrorComponentProps) {
  const router = useRouter();

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
            router.invalidate();
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
