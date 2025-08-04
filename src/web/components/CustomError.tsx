import { ErrorComponent, Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "./ui/button";

export function CustomError({ error }: ErrorComponentProps) {
  const router = useRouter();

  const clearCacheAndReload = async () => {
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

  console.error("CustomError Error:", error);

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Upsík dupsík!</h1>
      <ErrorComponent error={error} />
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant="outline"
          onClick={() => {
            router.invalidate();
          }}
        >
          Try Again
        </Button>
        <Button variant="outline" onClick={clearCacheAndReload}>
          Clear Cache & Reload
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
