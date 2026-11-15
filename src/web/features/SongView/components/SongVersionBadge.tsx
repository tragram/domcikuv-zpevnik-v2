import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import client from "src/worker/api-client";
import { Badge } from "~/components/ui/badge";
import { CompactItem } from "~/components/RichDropdown";
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
          className="gap-[0.4em] rounded-full border-transparent bg-control-surface/50 px-[0.65em] py-[0.3em] text-[0.55em] leading-none text-primary [&>svg]:size-[1em] cursor-pointer hover:bg-control-hover data-[state=open]:bg-control-hover focus-visible:outline-2 focus-visible:outline-primary"
        >
          <button type="button" aria-label={`Version details: ${details.label}`}>
            <Icon aria-hidden="true" />
            {details.label}
            <ChevronDown aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent
        container={typeof document === "undefined" ? undefined : document.fullscreenElement}
        align="end"
        sideOffset={12}
        collisionPadding={16}
        aria-label="Song version details"
        className={`${songPanelClassName} w-80 max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-1 text-sm font-normal`}
      >
        <div className="space-y-1">
          <h3 className="px-2 pt-1.5 pb-2 text-xs font-semibold uppercase tracking-wider text-primary">Version details</h3>
          <Separator />
          <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-1 px-2 py-1.5 text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
            {details.author && <><dt>Edited by</dt><dd className="first-letter:uppercase">{details.author}</dd></>}
            <dt>Status</dt>
            <dd>{details.status ?? (!isOnline ? "Not downloaded" : statusPending ? "Loading…" : "Unavailable")}</dd>
            {notes.length > 0 && <><dt>Notes</dt><dd className="space-y-1">{notes.map((text) => <p key={text}>{text}</p>)}</dd></>}
            {songData.externalSource && (
              <>
                <dt>Source</dt>
                <dd>
                    <a
                      href={songData.externalSource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {SONG_SOURCES_PRETTY[songData.externalSource.sourceId]}
                    </a>
                </dd>
              </>
            )}
          </dl>
          <div className="px-2 py-1.5">
            <CompactItem.Shell className="items-start">
              <CompactItem.Icon><Icon aria-hidden="true" /></CompactItem.Icon>
              <div className="min-w-0 flex-1">
                <p>{details.label}</p>
                <p className="text-tiny leading-tight text-muted-foreground">{details.reason}</p>
              </div>
            </CompactItem.Shell>
          </div>
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
