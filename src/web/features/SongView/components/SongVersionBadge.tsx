import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Description } from "~/components/ui/description";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { useSongbookEntry, type UserData } from "~/hooks/use-user-data";
import { useSaveSongbookVersion } from "~/hooks/use-save-songbook-version";
import type { SongData } from "~/types/songData";
import type { FeedStatus } from "../hooks/useSessionSync";
import { getVersionDetails, type VersionSelection } from "../utils/versionDetails";
import { SONG_SOURCES_PRETTY } from "src/lib/contracts/song-sources";
import { songPanelClassName } from "./songPanel";
import { SongVersionHistory } from "./SongVersionHistory";
import { songVersionsQueryOptions } from "~/services/song-service";
import { useIsOnline } from "~/hooks/use-is-online";
import { versionLabel, versionBadgeLabel } from "src/lib/version-label";
import { refreshSongVersions, versionAction } from "~/services/version-service";
import { selectableVersionIds } from "src/lib/song-selection";
import { songsQueryOptions } from "~/hooks/use-songDB";

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
  const [makingOfficial, setMakingOfficial] = useState(false);
  const save = useSaveSongbookVersion(songData.id, userData?.profile.id);
  const saving = makingOfficial || save.isPending;
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const router = useRouter();
  const { entry } = useSongbookEntry(songData.id, userData?.profile.id, songData.isFavorite);
  // Observe the existing catalog without fetching: availability belongs to the
  // song, so a cached pinned sheet must not freeze an older set of choices.
  const { data: publishedIds } = useQuery({
    ...songsQueryOptions(), enabled: false,
    select: (songs) => songs.find((song) => song.id === songData.id)?.publishedVersionIds,
  });
  // The offline catalog carries published IDs; summaries only add display details.
  const history = useQuery({
    ...songVersionsQueryOptions(songData.id, userData?.profile.id, songData.versionId),
    enabled: open && !!songData.versionId && isOnline,
  });
  const { data: versions, isPending: statusPending } = history;
  const resolvedStatus = versions?.find((version) => version.id === songData.versionId)?.status;
  const details = getVersionDetails(songData, userData, selection, feedStatus, resolvedStatus);
  const notes = details.notes;
  const shown = versions?.find((version) => version.id === songData.versionId);
  const isOfficial = shown?.isCurrent ?? songData.isOfficial === true;
  const label = versionLabel({ label: shown?.label ?? songData.versionLabel, importSourceId: songData.externalSource?.sourceId, isOfficial: isOfficial, versionNumber: shown?.versionNumber ?? songData.versionNumber, createdAt: songData.versionCreatedAt ?? songData.createdAt });

  const badgeLabel = versionBadgeLabel({ label, isOfficial: isOfficial });
  const hasDifferentOfficial = !!entry?.pinnedVersionId && !isOfficial && (publishedIds ?? songData.publishedVersionIds ?? []).some(id => id !== songData.versionId);
  const displayLabel = hasDifferentOfficial ? `${badgeLabel} · Official version available` : badgeLabel;

  async function makeOfficial() {
    if (!songData.versionId || !shown?.revision) return;
    setMakingOfficial(true);
    try {
      await versionAction(songData.id, songData.versionId, "official", shown.revision);
      await refreshSongVersions(queryClient, songData.id);
      await router.invalidate();
      toast.success("Official version selected");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not select official version"); }
    finally { setMakingOfficial(false); }
  }

  function saveVersion() {
    if (!userData || !songData.versionId || saving || !isOnline) return;
    save.mutate(songData.versionId, { onSuccess: () => setOpen(false) });
  }

  // Unsaved editor previews and external search previews have no version yet.
  const hasChoices = selectableVersionIds({
    song: { ...songData, publishedVersionIds: publishedIds ?? songData.publishedVersionIds }, savedEntry: entry,
    submissions: userData?.submissions,
  }).size > 1;
  if (!songData.versionId || (!hasChoices && !entry?.pinnedVersionId && !selection?.unavailable)) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          asChild
          variant="outline"
          className="max-w-full gap-[0.4em] rounded-full border-transparent bg-control-surface/50 px-[0.65em] py-[0.3em] text-[0.55em] leading-normal text-primary [&>svg]:size-[1em] cursor-pointer hover:bg-control-hover data-[state=open]:bg-control-hover focus-visible:outline-2 focus-visible:outline-primary"
        >
          <button type="button" aria-label={`Version details: ${displayLabel}`}>
            <span className="min-w-0 whitespace-normal break-words text-left" title={displayLabel}>{displayLabel}</span>
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
        className={`${songPanelClassName} w-80 max-[28rem]:w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto p-1 text-sm font-normal`}
      >
        <div className="space-y-1">
          <h3 className="px-2 pt-1.5 pb-2 text-xs font-semibold uppercase tracking-wider text-primary">Version details</h3>
          <Separator />
          <div className="space-y-1 px-2 py-1.5">
            <p className="font-medium">{label}</p>
            {(shown?.description ?? songData.versionDescription) && <Description>{shown?.description ?? songData.versionDescription}</Description>}
            {hasDifferentOfficial && <Description>A different version is official. View it below, then select the heart to update your songbook.</Description>}
          </div>
          <Separator />
          <dl className="space-y-2 px-2 py-1.5 text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
            {(shown?.author || details.author) && <div className="flex flex-wrap items-baseline gap-x-1"><dt>Author:</dt><dd className="first-letter:uppercase">{shown?.author ? shown.author.id === userData?.profile.id ? "you" : shown.author.name : details.author}</dd></div>}
            <div className="flex flex-wrap items-baseline gap-x-1"><dt>Status:</dt>
            <dd>{details.status ?? (!isOnline ? "Not downloaded" : statusPending ? "Loading…" : "Unavailable")}{isOfficial && " · Official"}</dd></div>
            <div className="space-y-0.5"><dt>Shown because</dt>
            <dd><Description>{details.reason}</Description></dd></div>
            {notes.length > 0 && <div className="space-y-0.5"><dt>Notes</dt><dd className="space-y-1">{notes.map((text) => <p key={text}>{text}</p>)}</dd></div>}
            {songData.externalSource && (
              <div className="flex flex-wrap items-baseline gap-x-1">
                <dt>Source:</dt>
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
              </div>
            )}
          </dl>
          <SongVersionHistory
            songId={songData.id}
            shownVersionId={songData.versionId}
            viewerId={userData?.profile.id}
            savedSheet={entry?.song}
            savedVersionId={entry?.pinnedVersionId}
            saving={saving}
            onUse={details.canChoose ? saveVersion : undefined}
            canPreview={details.canPreview}
            history={history}
            isOnline={isOnline}
          />
          {shown?.status === "published" && !shown.isCurrent && (userData?.profile.isAdmin || userData?.profile.isTrusted) && <button className="m-2 text-xs text-primary underline" disabled={!isOnline || saving} onClick={() => void makeOfficial()}>Make official</button>}

        </div>
      </PopoverContent>
    </Popover>
  );
}
