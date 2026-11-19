import { getCorrectionParent } from "./version-selection";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import ReactDiffViewer from "react-diff-viewer-continued";
import type { SongVersionDB } from "src/lib/db/schema";
import client from "src/worker/api-client";
import { versionLabel } from "src/lib/version-label";
import { songContentFields, songContentLabels } from "src/lib/song-content";
import { Button } from "~/components/ui/button";
import { VersionActionButton } from "~/components/VersionActionButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { makeApiRequest } from "~/services/api-service";
import { refreshSongVersions } from "~/services/version-service";
import { useIsOnline } from "~/hooks/use-is-online";


export function VersionReclassification({
  source,
  versions,
  officialId,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  source: SongVersionDB;
  versions: SongVersionDB[];
  officialId: string | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const target = getCorrectionParent(source, versions);
  const cache = useQueryClient();
  const router = useRouter();
  const online = useIsOnline();
  const mutation = useMutation({
    mutationFn: () =>
      makeApiRequest(() =>
        client.api.admin.songs[":songId"].versions[":versionId"].reclassify.$post({
          param: { songId: source.songId, versionId: source.id },
          json: {
            expectedRevision: source.revision,
            expectedParentRevision: target!.revision,
          },
        }),
      ),
    onSuccess: async () => {
      await refreshSongVersions(cache, source.songId);
      await router.invalidate();
      setOpen(false);
      toast.success("Applied as a correction to the parent; both histories preserved");
    },
    onError: (error) => toast.error(error.message),
  });
  if (
    !target ||
    source.mergedIntoVersionId ||
    !["pending", "published", "archived"].includes(source.status)
  )
    return null;
  return (
    <>
      {!hideTrigger && <VersionActionButton onClick={() => setOpen(true)}>
        Reclassify as correction
      </VersionActionButton>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Review correction to parent</DialogTitle>
          </DialogHeader>
          <p>Apply “{versionLabel(source)}” as a revision of its parent, <strong>{versionLabel(target)}</strong>.</p>
          <p className="text-sm">
            The mistaken separate version will leave the version list. Its songbook pins will follow the
            parent, preserving each saved key and capo. Both histories
            remain available.{" "}
            {source.id === officialId
              ? "The parent becomes official."
              : "Official selection stays unchanged."}
          </p>
          <p className="text-sm">
            The sheet and musical metadata will be applied. The parent's name,
            description and ownership stay unchanged.
          </p>
          {target && (
            <>
              <div className="min-w-0 overflow-x-auto">
                <ReactDiffViewer
                  oldValue={target.chordpro}
                  newValue={source.chordpro}
                  splitView={false}
                  leftTitle="Current parent"
                  rightTitle="Proposed revision"
                />
              </div>
              <details>
                <summary className="cursor-pointer">Metadata changes</summary>
                <div className="min-w-0 overflow-x-auto">
                  <ReactDiffViewer
                    oldValue={JSON.stringify(
                      Object.fromEntries(
                        songContentFields
                          .filter((key) => !["chordpro", "label", "description"].includes(key))
                          .map((key) => [songContentLabels[key], target[key]]),
                      ),
                      null,
                      2,
                    )}
                    newValue={JSON.stringify(
                      Object.fromEntries(
                        songContentFields
                          .filter((key) => !["chordpro", "label", "description"].includes(key))
                          .map((key) => [songContentLabels[key], source[key]]),
                      ),
                      null,
                      2,
                    )}
                    splitView={false}
                  />
                </div>
              </details>
            </>
          )}
          <Button
            disabled={!online || !target || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Applying…" : "Apply revision"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
