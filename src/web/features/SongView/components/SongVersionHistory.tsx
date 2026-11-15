import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, Info } from "lucide-react";
import { getCachedSongVersion } from "~/services/song-service";
import type { SongVersionSummaryApi } from "src/worker/api/api-types";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

const versionDate = new Intl.DateTimeFormat(undefined, {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

interface SongVersionHistoryProps {
  songId: string;
  shownVersionId: string;
  viewerId?: string;
  canPreview: boolean;
  savedVersionId?: string | null;
  saving: boolean;
  onUse?: () => void;
  history: UseQueryResult<SongVersionSummaryApi[]>;
  isOnline: boolean;
}

/** Renders the same history query used by the current-version details. */
export function SongVersionHistory({
  songId,
  shownVersionId,
  viewerId,
  canPreview,
  savedVersionId,
  saving,
  onUse,
  history,
  isOnline,
}: SongVersionHistoryProps) {
  const cache = useQueryClient();
  const { data: versions, isPending, isError, refetch } = history;

  if (!versions && (!isOnline || isPending)) {
    return <p className="text-xs text-muted-foreground" role="status">{isOnline ? "Loading versions…" : "Connect to download version history."}</p>;
  }
  if (isError && !versions) return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <p className="text-muted-foreground">Couldn't load other versions.</p>
      <Button variant="link" size="sm" onClick={() => void refetch()}>Try again</Button>
    </div>
  );
  if (!versions?.length) return null;

  return (
    <div className="space-y-3">
      {isError && isOnline && <p className="px-3 text-xs text-muted-foreground" role="status">Couldn't refresh versions. Showing downloaded history.</p>}
      {!isOnline && <p className="px-3 text-xs text-muted-foreground">Offline · downloaded versions only</p>}
      <div className="flex items-center justify-between px-3">
        <h3 className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Available versions</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{versions.length}</span>
      </div>
      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-xs">
        <caption className="sr-only">Available song versions</caption>
        <colgroup><col /><col className="w-12" /><col className="w-20" /></colgroup>
        <thead className="border-b border-primary/20 text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-normal">Version</th>
            <th scope="col" className="py-2 font-normal">Key</th>
            <th scope="col" className="py-2 font-normal text-right"><span className="sr-only">Choose version</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary/10">
          {versions.map((version) => {
            const shown = version.id === shownVersionId;
            const downloaded = shown || !!getCachedSongVersion(cache, songId, version.id);
            const title = version.isCurrent ? "Official version" : version.status === "pending" ? "Your pending edit" : "Earlier version";
            const createdAt = versionDate.format(new Date(version.createdAt));
            return (
              <tr key={version.id} className={cn(shown && "[&>td]:bg-primary/10 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg")} aria-current={shown ? "true" : undefined}>
                <td className="py-3 px-3 align-top">
                  <p className={cn("font-medium", shown && "text-primary")}>{title}</p>
                  {!shown && version.id === savedVersionId && <p className="text-[0.65rem] text-primary">Saved in your songbook</p>}
                  <p className="text-[0.65rem] text-muted-foreground">{createdAt}</p>
                  <p className="text-[0.65rem] text-muted-foreground break-words">{version.author.id === viewerId ? "You" : version.author.name}</p>
                </td>
                <td className="py-3 align-top text-foreground/80">
                  {version.key ?? "—"}
                  {version.capo != null && version.capo > 0 && <p className="text-[0.65rem] text-muted-foreground">Capo {version.capo}</p>}
                </td>
                <td className="py-3 pr-3 text-right align-top">
                  {version.id === savedVersionId && shown ? (
                    <span className="inline-flex items-center gap-1 text-primary text-[0.65rem]"><Check className="size-3" />Saved</span>
                  ) : shown && onUse ? (
                    <button
                      type="button"
                      disabled={saving || !isOnline}
                      title={!isOnline ? "Connect to save your songbook choice" : undefined}
                      aria-busy={saving}
                      onClick={onUse}
                      aria-label={`Save ${title.toLowerCase()} from ${createdAt} to your songbook`}
                      className="inline-flex rounded-full border border-primary/25 px-2 py-1 text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    >{saving ? "Saving…" : "Use"}</button>
                  ) : shown ? (
                    <span className="inline-flex items-center gap-1 text-primary text-[0.65rem]"><Check className="size-3" />Viewing</span>
                  ) : canPreview && (isOnline || downloaded) ? (
                    <Link
                      to="/song/$songId"
                      params={{ songId }}
                      search={{ version: version.id }}
                      aria-label={`View ${title.toLowerCase()} from ${createdAt}`}
                      className="inline-flex rounded-full border border-primary/25 px-2 py-0.5 text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
                    >View</Link>
                  ) : canPreview && !isOnline ? <span className="text-[0.65rem] text-muted-foreground">Not downloaded</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(onUse || (canPreview && versions.length > 1)) && (
        <div className="border-t border-primary/20 pt-4">
          <div className="flex gap-2 rounded-xl bg-primary/5 p-3">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary/80" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {onUse
                ? "View previews a version. Use saves the displayed version to your songbook."
                : "Sign in to save your version choice. You can preview versions here."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
