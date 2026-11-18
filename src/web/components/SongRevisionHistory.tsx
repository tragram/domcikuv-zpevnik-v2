import { useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { useTheme } from "next-themes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { History } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { VersionActionButton } from "~/components/VersionActionButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useUserData } from "~/hooks/use-user-data";
import { useIsOnline } from "~/hooks/use-is-online";
import {
  refreshSongVersions,
  restoreSongRevision,
  revisionsQueryOptions,
} from "~/services/version-service";
import { songContentLabels, songContentFields } from "src/lib/song-content";

export function SongRevisionHistory({
  songId,
  versionId,
  ownerId,
  currentRevision,
  status,
  merged,
  iconOnly = false,
}: {
  songId: string;
  versionId: string;
  ownerId?: string;
  currentRevision?: number;
  status?: string;
  merged?: boolean;
  iconOnly?: boolean;
}) {
  const { userData } = useUserData();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const { resolvedTheme } = useTheme();
  const cache = useQueryClient();
  const router = useRouter();
  const online = useIsOnline();
  const viewer = userData?.profile;
  const allowed = !!viewer && (viewer.id === ownerId || viewer.isAdmin);
  const history = useQuery({
    ...revisionsQueryOptions(songId, versionId, viewer?.id ?? "", offset),
    enabled: allowed && open && online,
  });
  const canRestore =
    allowed &&
    !merged &&
    status !== "deleted" &&
    (status === "pending" || viewer?.isAdmin || viewer?.isTrusted);
  async function restore(number: number) {
    if (
      !currentRevision ||
      !window.confirm(
        "Restore this content as a new revision? Later history will be preserved.",
      )
    )
      return;
    setRestoring(true);
    try {
      await restoreSongRevision(songId, versionId, number, currentRevision);
      await refreshSongVersions(cache);
      await router.invalidate();
      toast.success("Content restored as a new revision");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not restore revision",
      );
    } finally {
      setRestoring(false);
    }
  }
  if (!allowed) return null;
  return (
    <>
      <VersionActionButton
        onClick={() => setOpen(true)}
        aria-label="Revision history"
        title="Revision history"
        className={iconOnly ? "size-8 p-0" : undefined}
      >
        <History className="size-4" />{!iconOnly && "Revision history"}
      </VersionActionButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Revision history</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Each entry compares a saved revision with the immediately preceding
            revision of this same version. Restoring content creates a new revision.
          </p>
          {history.isError && (
            <p role="alert">
              Could not load history.{" "}
              <button onClick={() => void history.refetch()}>Try again</button>
            </p>
          )}
          {!history.data && (
            <p>
              {online
                ? "Loading history…"
                : "Connect to load revision history."}
            </p>
          )}
          {history.data?.revisions.map((revision) => (
            <details
              key={revision.id}
              className="min-w-0 rounded-lg border p-3"
              onToggle={(event) => {
                const isOpen = event.currentTarget.open;
                setExpanded((previous) => {
                  const next = new Set(previous);
                  if (isOpen) next.add(revision.id);
                  else next.delete(revision.id);
                  return next;
                });
              }}
            >
              <summary className="cursor-pointer">
                {new Date(revision.createdAt).toLocaleString()} ·{" "}
                {revision.contributorName}
                {revision.number === currentRevision ? " · Current" : ""}
              </summary>
              {expanded.has(revision.id) && (
                <div className="mt-3 space-y-3">
                  {revision.previousContent ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Changes from the previous revision of this version
                      </p>
                      {revision.previousContent.chordpro !==
                      revision.content.chordpro ? (
                        <div className="min-w-0 overflow-x-auto">
                          <ReactDiffViewer
                            oldValue={revision.previousContent.chordpro}
                            newValue={revision.content.chordpro}
                            splitView={false}
                            useDarkTheme={resolvedTheme === "dark"}
                            leftTitle="Previous revision"
                            rightTitle="Selected revision"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          The sheet is unchanged.
                        </p>
                      )}
                      <dl className="space-y-2 text-sm">
                        {songContentFields
                          .filter(
                            (key) =>
                              key !== "chordpro" &&
                              revision.previousContent![key] !==
                                revision.content[key],
                          )
                          .map((key) => (
                            <div key={key}>
                              <dt className="font-medium">
                                {songContentLabels[key]}
                              </dt>
                              <dd>
                                <del className="text-red-600">
                                  {String(
                                    revision.previousContent![key] ?? "Empty",
                                  )}
                                </del>
                                {" → "}
                                <ins className="text-green-600 no-underline">
                                  {String(revision.content[key] ?? "Empty")}
                                </ins>
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      First saved submission.
                    </p>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Full saved content
                    </summary>
                    <dl className="my-3 grid grid-cols-[auto_1fr] gap-x-4 text-sm">
                      {songContentFields
                        .filter((key) => key !== "chordpro")
                        .map((key) => (
                          <div key={key} className="contents">
                            <dt className="text-muted-foreground">
                              {songContentLabels[key]}
                            </dt>
                            <dd>{String(revision.content[key] ?? "—")}</dd>
                          </div>
                        ))}
                    </dl>
                    <pre className="whitespace-pre-wrap break-words rounded bg-muted p-3 text-sm">
                      {revision.content.chordpro}
                    </pre>
                  </details>
                  {canRestore && revision.number !== currentRevision && (
                    <Button
                      className="mt-3"
                      disabled={!online || restoring || !currentRevision}
                      onClick={() => void restore(revision.number)}
                    >
                      Restore this content
                    </Button>
                  )}
                </div>
              )}
            </details>
          ))}
          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 25))}
            >
              Newer
            </Button>
            <Button
              variant="outline"
              disabled={history.data?.nextOffset == null}
              onClick={() => setOffset(history.data?.nextOffset ?? offset)}
            >
              Older
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
