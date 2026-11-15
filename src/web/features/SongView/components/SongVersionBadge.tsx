import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import client from "src/worker/api-client";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { favoritesQueryOptions, useSongbookEntry, type UserData } from "~/hooks/use-user-data";
import { makeApiRequest } from "~/services/api-service";
import type { SongData } from "~/types/songData";
import type { FeedStatus } from "../hooks/useSessionSync";
import { getVersionDetails, type VersionSelection } from "../utils/versionDetails";
import { SONG_SOURCES_PRETTY } from "src/lib/contracts/song-sources";
import { songPanelClassName } from "./songPanel";
import { SongVersionHistory } from "./SongVersionHistory";
import { songVersionsQueryOptions } from "~/services/song-service";
import { useIsOnline } from "~/hooks/use-is-online";

interface SongVersionBadgeProps {
  songData: SongData;
  userData?: UserData;
  selection?: VersionSelection;
  feedStatus?: FeedStatus;
}

export function SongVersionBadge({
  songData,
  userData,
  selection,
  feedStatus,
}: SongVersionBadgeProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const router = useRouter();
  const { entry } = useSongbookEntry(songData.id, userData?.profile.id, songData.isFavorite);
  // Persisted song rows from older builds may lack versionStatus. The history
  // request is shared with the version table and only runs while this is open.
  const history = useQuery({
    ...songVersionsQueryOptions(songData.id, userData?.profile.id),
    enabled: open && !!songData.versionId && isOnline,
  });
  const { data: versions, isPending: statusPending } = history;
  const resolvedStatus = versions?.find((version) => version.id === songData.versionId)?.status;
  const details = getVersionDetails(songData, userData, selection, feedStatus, resolvedStatus);
  const notes = details.notes;

  async function saveVersion() {
    if (!userData || !songData.versionId || saving || !isOnline) return;
    setSaving(true);
    try {
      await makeApiRequest(() =>
        client.api.favorites[":songId"].$patch({
          param: { songId: songData.id },
          json: { pinnedVersionId: songData.versionId },
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: favoritesQueryOptions(userData.profile.id).queryKey,
        refetchType: "all",
      });
      await navigate({
        to: "/song/$songId",
        params: { songId: songData.id },
        search: {},
      });
      await router.invalidate();
      toast.success("Version saved to your songbook");
      setOpen(false);
    } catch {
      toast.error("Couldn't save your version preference. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Unsaved editor previews and external search previews have no version yet.
  if (!songData.versionId) return null;

  const Icon = songData.isCustom ? Pencil : Check;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          asChild
          variant="outline"
          className="gap-[0.35em] px-[0.6em] py-[0.2em] text-[0.6em] leading-none [&>svg]:size-[1em] border-primary/30 bg-primary/5 text-primary dark:border-white/25 dark:bg-white/10 dark:text-white/80 cursor-pointer hover:bg-primary/10 dark:hover:bg-white/20"
        >
          <button type="button" aria-label={`Version details: ${details.label}`}>
            <Icon aria-hidden="true" />
            {details.label}
            <ChevronDown aria-hidden="true" className="opacity-60" />
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        container={typeof document === "undefined" ? undefined : document.fullscreenElement}
        align="end"
        sideOffset={12}
        collisionPadding={16}
        aria-label="Song version details"
        className={`${songPanelClassName} w-96 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto text-sm font-normal`}
      >
        <div className="space-y-4">
          <table className="w-full table-fixed border-collapse text-left text-xs leading-relaxed">
            <caption className="sr-only">Current song version</caption>
            <colgroup>
              <col className="w-20" />
              <col />
            </colgroup>
            <tbody className="[&>tr+tr]:border-t [&>tr]:border-primary/15 [&_th]:w-20 [&_th]:py-2.5 [&_th]:pr-3 [&_th]:align-top [&_th]:font-medium [&_th]:text-primary/80 [&_td]:py-2.5 [&_td]:align-top [&_td]:break-words [&_td]:text-foreground/80 [&>tr:first-child>*]:pt-0 [&>tr:last-child>*]:pb-0">
              <tr>
                <th scope="row">Version</th>
                <td>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {details.label}
                  </span>
                </td>
              </tr>
              <tr>
                <th scope="row">Reason</th>
                <td>{details.reason}</td>
              </tr>
              {details.author && (
                <tr>
                  <th scope="row">Edited by</th>
                  <td className="first-letter:uppercase">{details.author}</td>
                </tr>
              )}
              <tr>
                <th scope="row">Status</th>
                <td>{details.status ?? (!isOnline ? "Not downloaded" : statusPending ? "Loading…" : "Unavailable")}</td>
              </tr>
              {notes.length > 0 && (
                <tr>
                  <th scope="row">Notes</th>
                  <td className="space-y-2">
                    {notes.map((text) => <p key={text}>{text}</p>)}
                  </td>
                </tr>
              )}
              {songData.externalSource && (
                <tr>
                  <th scope="row">Source</th>
                  <td>
                    <a
                      href={songData.externalSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {SONG_SOURCES_PRETTY[songData.externalSource.sourceId]}
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Separator className="bg-primary/15" />
          <SongVersionHistory
            songId={songData.id}
            shownVersionId={songData.versionId}
            viewerId={userData?.profile.id}
            savedVersionId={entry?.pinnedVersionId}
            saving={saving}
            onUse={details.canChoose ? () => void saveVersion() : undefined}
            canPreview={details.canPreview}
            history={history}
            isOnline={isOnline}
          />

        </div>
      </PopoverContent>
    </Popover>
  );
}
