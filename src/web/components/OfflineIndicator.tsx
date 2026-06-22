import { Link } from "@tanstack/react-router";
import { House, WifiOff } from "lucide-react";
import { useIsOnline } from "~/hooks/use-is-online";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";

/**
 * Slim, always-mounted badge that appears only while offline, so the user always
 * has context for why some actions (login, sync, import, …) are unavailable.
 * Rendered once from the root route.
 */
export function OfflineIndicator() {
  const isOnline = useIsOnline();
  if (isOnline) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5",
          "bg-background/90 text-foreground/90 border-2 border-primary shadow-lg backdrop-blur",
          "text-sm font-medium",
        )}
      >
        <WifiOff className="h-4 w-4 text-primary" />
        Offline
      </div>
    </div>
  );
}

/**
 * Compact inline note for forms whose submit needs the network (login, signup).
 * Renders nothing while online. Pair it with `disabled={!isOnline}` on the
 * relevant buttons.
 */
export function OfflineInlineNote({ message }: { message: string }) {
  const isOnline = useIsOnline();
  if (isOnline) return null;
  return (
    <div
      className="flex items-center justify-center gap-2 rounded-md border-2 border-primary/60 bg-primary/10 px-3 py-2 text-sm text-foreground/90"
      role="status"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-primary" />
      {message}
    </div>
  );
}

/**
 * Compact, inline offline chip meant to sit inside an existing toolbar (e.g. the
 * editor), where the floating `OfflineIndicator` badge would overlap content.
 * Renders nothing while online.
 */
export function OfflineToolbarBadge({ className }: { className?: string }) {
  const isOnline = useIsOnline();
  if (isOnline) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 text-sm font-medium text-primary",
        className,
      )}
      role="status"
      aria-live="polite"
      title="Offline — your draft is saved locally"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      Offline
    </div>
  );
}

interface OfflineNoticeProps {
  /** What the user was trying to reach, e.g. "Importing songs". */
  title?: string;
  /** Optional extra explanation under the title. */
  description?: string;
}

/**
 * Full-screen "this needs a connection" notice for online-only routes (import,
 * feed, admin, gallery, …) when reached offline via a link or reload. Keeps those
 * pages graceful instead of crashing or spinning forever.
 */
export function OfflineNotice({
  title = "You're offline",
  description = "This page needs an internet connection. Reconnect and try again — your saved songs are still available offline.",
}: OfflineNoticeProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 text-center">
      <WifiOff className="h-12 w-12 text-primary" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground max-w-md">{description}</p>
      </div>
      <Button variant="outline" asChild>
        <Link to="/">
          <House />
          Back to songs
        </Link>
      </Button>
    </div>
  );
}
