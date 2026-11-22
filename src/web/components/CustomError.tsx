import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { House, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { clearPersistedCache } from "src/lib/query-client";
import { getIsOnline, useIsOnline } from "~/hooks/use-is-online";
import { retryAppLoad, updateLabels, useAppUpdate } from "~/services/app-updates";
import ConfirmationDialog from "./dialogs/confirmation-dialog";
import { Button } from "./ui/button";

const assetLoadError = /dynamically imported module|importing a module script failed|chunkloaderror|loading chunk .* failed|unable to preload css/i;

export function CustomError({ error }: ErrorComponentProps) {
  const online = useIsOnline();
  const update = useAppUpdate();
  const [retrying, setRetrying] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);
  const message = typeof error?.message === "string" ? error.message : undefined;
  const checkForNewBuild = assetLoadError.test(`${error?.name ?? ""} ${message ?? ""}`);
  const downloading = online && checkForNewBuild && update === "downloading";
  const restarting = update === "restarting";
  const busy = retrying || restarting || repairing;

  useEffect(() => {
    console.error("Songbook error:", error);
  }, [error]);

  async function retry() {
    setRetrying(true);
    try {
      await retryAppLoad(checkForNewBuild);
    } finally {
      setRetrying(false);
    }
  }

  async function repair() {
    if (!getIsOnline()) return;
    setRepairFailed(false);
    setRepairing(true);
    try {
      await clearPersistedCache();
      window.location.reload();
    } catch (err) {
      console.error("Songbook repair failed:", err);
      setRepairFailed(true);
      setRepairing(false);
    }
  }

  return (
    <div className="min-w-0 flex-1 p-4 flex flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        {online ? "We couldn’t open this page. Try again or return to the songbook."
          : "You’re offline. Try opening the page again once you’re connected."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={retry} disabled={busy || downloading}>
          <RefreshCcw />
          {restarting || retrying ? "Trying again…" : online && update === "ready" ? updateLabels.ready : "Try again"}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/" reloadDocument>
            <House />
            Back to songbook
          </Link>
        </Button>
      </div>
      {online && update === "otherTabs" && (
        <p role="status" className="text-sm text-muted-foreground">
          Close any other songbook tabs, then try again to finish updating.
        </p>
      )}
      {downloading && <p role="status" className="text-sm text-muted-foreground">Downloading an app update…</p>}
      {repairFailed && <p role="alert" className="text-sm text-muted-foreground">The repair couldn’t finish. Please try again.</p>}
      <ConfirmationDialog
        trigger={<Button variant="ghost" size="sm" disabled={!online || busy}>{repairing ? "Repairing…" : "Repair app"}</Button>}
        title="Repair the songbook?"
        description="Repair removes offline song data and reloads the app. Reopen any sheets you need while you’re online to save them again. Repair keeps your settings and saved drafts."
        confirmText="Repair and reload"
        variant="destructive"
        onConfirm={repair}
      />
      {message && (
        <details className="max-w-full text-sm text-muted-foreground">
          <summary className="cursor-pointer">Technical details</summary>
          <p className="mt-2 wrap-anywhere">{message}</p>
        </details>
      )}
    </div>
  );
}
