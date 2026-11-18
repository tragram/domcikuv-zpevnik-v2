import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, History, Pencil } from "lucide-react";
import { getCachedSongVersion } from "~/services/song-service";
import type { SongVersionSummaryApi } from "src/worker/api/api-types";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import { CompactItem } from "~/components/RichDropdown";
import { Separator } from "~/components/ui/separator";
import { versionLabel } from "src/lib/version-label";

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
    return <p className="px-2 py-1.5 text-xs text-muted-foreground" role="status">{isOnline ? "Loading versions…" : "Connect to download version history."}</p>;
  }
  if (isError && !versions) return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
      <p className="text-muted-foreground">Couldn't load other versions.</p>
      <Button variant="link" size="sm" onClick={() => void refetch()}>Try again</Button>
    </div>
  );
  if (!versions?.length) return null;

  return (
    <div className="space-y-1">
      {isError && isOnline && <p className="px-2 text-xs text-muted-foreground" role="status">Couldn't refresh versions. Showing downloaded history.</p>}
      {!isOnline && <p className="px-2 text-xs text-muted-foreground">Offline · downloaded versions only</p>}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Available versions</h3>
        <span className="text-xs text-primary">{versions.length}</span>
      </div>
      <Separator />
      <ul aria-label="Available song versions">
          {versions.map((version) => {
            const shown = version.id === shownVersionId;
            const downloaded = shown || !!getCachedSongVersion(cache, songId, version.id);
            const title = versionLabel(version);
            const VersionIcon = version.isCurrent ? Check : version.status === "pending" ? Pencil : History;
            const createdAt = versionDate.format(new Date(version.updatedAt ?? version.createdAt));
            return (
              <li key={version.id} className={cn("rounded-lg px-2 py-1.5", shown && "bg-primary/10")} aria-current={shown ? "true" : undefined}>
                <CompactItem.Shell>
                  <CompactItem.Icon><VersionIcon aria-hidden="true" /></CompactItem.Icon>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <p className={cn(shown && "text-primary")}>{title}</p>
                      {version.isCurrent && <Badge variant="outline" className="border-primary/30 bg-primary/10 px-1.5 py-0 text-tiny font-normal text-primary">Official</Badge>}
                    </div>
                    {!shown && version.id === savedVersionId && <p className="text-tiny text-primary">Saved in your songbook</p>}
                    <p className="text-tiny leading-tight text-muted-foreground break-words">{createdAt} · {version.author.id === viewerId ? "You" : version.author.name}</p>
                    <p className="text-tiny leading-tight text-muted-foreground">
                      Key {version.key ?? "—"}{version.capo != null && version.capo > 0 && ` · Capo ${version.capo}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
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
                      className="inline-flex rounded-full bg-control-surface px-2 py-1 text-xs text-primary hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                    >{saving ? "Saving…" : "Use"}</button>
                  ) : shown ? (
                    <span className="inline-flex items-center gap-1 text-primary text-[0.65rem]"><Check className="size-3" />Viewing</span>
                  ) : canPreview && (isOnline || downloaded) ? (
                    <Link
                      to="/song/$songId"
                      params={{ songId }}
                      search={{ version: version.id }}
                      aria-label={`View ${title.toLowerCase()} from ${createdAt}`}
                      className="inline-flex rounded-full bg-control-surface px-2 py-1 text-xs text-primary hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-primary"
                    >View</Link>
                  ) : canPreview && !isOnline ? <span className="text-[0.65rem] text-muted-foreground">Not downloaded</span> : null}
                  </div>
                </CompactItem.Shell>
              </li>
            );
          })}
      </ul>
      {(viewerId || onUse || (canPreview && versions.length > 1)) && (
        <div>
          <Separator />
            {(onUse || (canPreview && versions.length > 1)) && <p className="px-2 py-1.5 text-tiny leading-tight text-muted-foreground">
              {onUse
                ? "View previews a version. Use saves the displayed version to your songbook."
                : viewerId
                  ? "View opens another version without changing this songbook."
                  : "You can view other versions without signing in. Sign in to save your own choice."}
            </p>}
            {viewerId && <p className="px-2 py-1.5 text-tiny leading-tight text-muted-foreground">
              Restore your archived versions from <Link to="/submissions" className="text-primary underline underline-offset-2">Submissions</Link>.
            </p>}
        </div>
      )}
    </div>
  );
}
