import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { FavoriteButton } from "~/components/FavoriteButton";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import type { LayoutSettings } from "../hooks/viewSettingsStore";
import { SONG_SOURCES_PRETTY } from "src/lib/db/schema/song.schema";
import { Link, useNavigate } from "@tanstack/react-router";
import { Pencil, RotateCcw, type LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import client from "src/worker/api-client";
import { makeApiRequest } from "~/services/api-service";
import { patchFavoriteEntry, UserData } from "src/web/hooks/use-user-data";
import { Badge } from "src/web/components/ui/badge";
import type { FeedStatus } from "../hooks/useSessionSync";
import type { SongTranspose } from "../hooks/songTransposeMath";
import CapoControl from "../settings/CapoSettings";

/**
 * Pins `targetVersionId` (or unpins, for `null` = back to canonical) and
 * navigates to show it. Shared by both switch directions so the optimistic
 * cache patch / navigation / persistence flow lives in one place.
 */
function useSwitchVersion(songId: string, userId?: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(
    async (targetVersionId: string | null) => {
      if (!userId) return;
      patchFavoriteEntry(queryClient, userId, songId, {
        pinnedVersionId: targetVersionId,
        song: undefined,
      });
      navigate({
        to: "/song/$songId",
        params: { songId },
        search: targetVersionId ? { version: targetVersionId } : {},
        replace: true,
      });
      try {
        await makeApiRequest(() =>
          client.api.favorites[":songId"].$patch({
            param: { songId },
            json: { pinnedVersionId: targetVersionId },
          }),
        );
      } catch {
        toast.error("Failed to switch version");
      }
    },
    [queryClient, navigate, songId, userId],
  );
}

/** Draft-status badge that becomes a clickable version-switch action when `action` is set. */
function VersionBadge({
  icon: Icon,
  action,
  children,
}: {
  icon: LucideIcon;
  action?: { label: string; title: string; onClick: () => void };
  children?: React.ReactNode;
}) {
  return (
    <Badge
      asChild={!!action}
      variant="outline"
      className={cn(
        "gap-1 border-primary/30 bg-primary/5 text-primary",
        "dark:border-white/25 dark:bg-white/10 dark:text-white/80",
        action && "cursor-pointer hover:bg-primary/10 dark:hover:bg-white/20",
      )}
    >
      {action ? (
        <button type="button" onClick={action.onClick} title={action.title}>
          <Icon />
          {action.label}
        </button>
      ) : (
        <>
          <Icon />
          {children}
        </>
      )}
    </Badge>
  );
}

interface SongHeadingProps {
  songData: SongData;
  layoutSettings: LayoutSettings;
  // The viewer's resolved key/capo. Omitted in read-only contexts (the editor
  // preview): the heading then falls back to the song's own key/capo and the
  // capo stepper is inert.
  transpose?: SongTranspose;
  // Optional banner under the title (e.g. version-fallback note).
  note?: string;
  // Set when viewing another user's songbook read-only; used to attribute their
  // custom version in the draft badge ("<owner>'s draft" instead of "Your draft").
  songbookOwnerName?: string;
  userData?: UserData;
  feedStatus?: FeedStatus;
}

// (Helper function formatChords kept the same...)
function formatChords(data: string) {
  return data.split(/(\d|[#b])/).map((part, index) => {
    if (/\d/.test(part)) return <sub key={index}>{part}</sub>;
    if (/[#b]/.test(part)) return <sup key={index}>{part}</sup>;
    return part;
  });
}
const SongHeading: React.FC<SongHeadingProps> = ({
  songData,
  layoutSettings,
  transpose,
  note,
  songbookOwnerName,
  userData,
  feedStatus,
}) => {
  // Read-only contexts (editor preview) pass no transpose: fall back to the
  // song's own key/capo and leave the capo stepper inert.
  const transposeSteps = transpose?.transposeSteps ?? 0;
  const capo = transpose?.capo ?? songData.capo ?? 0;
  const originalCapo = transpose?.originalCapo ?? songData.capo ?? 0;
  const setCapo = transpose?.setCapo;
  const songbookPersonalization = transpose?.songbookPersonalization;
  const canEditCapo = !!userData && !!setCapo;
  // The custom version on screen isn't always the current user's: when following
  // someone's session it's the host's, and when browsing another user's songbook
  // it's that owner's. Attribute it to whoever it actually belongs to.
  const sessionHost =
    feedStatus?.enabled && !feedStatus.isMaster
      ? feedStatus.sessionState?.masterNickname
      : undefined;
  // A directly-fetched draft (e.g. an admin reviewing a submission) carries its
  // author: attribute it to them unless it's the viewer's own.
  const customAuthor = songData.customVersionAuthor;
  const foreignDraftAuthor =
    customAuthor && customAuthor.id !== userData?.profile.id
      ? customAuthor.name
      : undefined;
  const draftAuthor = sessionHost ?? songbookOwnerName ?? foreignDraftAuthor;

  const isOwnContext = !!userData && !sessionHost && !songbookOwnerName;
  const switchVersion = useSwitchVersion(songData.id, userData?.profile.id);

  // "Switch to official version": shown on the viewer's own draft once the
  // published version has moved past it.
  const canSwitchToCanonical =
    isOwnContext && customAuthor?.id === userData?.profile.id &&
    !!songData.canonicalIsNewer;

  // "Switch back to your version": shown on the canonical version only when
  // the viewer's *latest* submission for this song isn't the one on screen
  const latestOwnSubmission =
    isOwnContext && !songData.isCustom
      ? userData?.submissions.find((s) => s.songId === songData.id)
      : undefined;
  const ownOtherSubmission =
    latestOwnSubmission &&
    latestOwnSubmission.id !== songData.versionId &&
    (latestOwnSubmission.status === "pending" ||
      latestOwnSubmission.status === "archived")
      ? latestOwnSubmission
      : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const [isWrapped, setIsWrapped] = useState(false);

  useLayoutEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const children = Array.from(parent.children) as HTMLElement[];
        if (children.length < 2) return;

        const [left, right] = children;

        // 1. Temporarily neutralize the elements to measure natural flow
        const originalLeftWidth = left.style.width;
        const originalRightWidth = right.style.width;

        left.style.width = "auto";
        right.style.width = "auto";

        // 2. Perform the measurement
        const wrapped = right.offsetTop > left.offsetTop;

        // 3. Restore immediately
        left.style.width = originalLeftWidth;
        right.style.width = originalRightWidth;

        setIsWrapped(wrapped);
      });
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, [layoutSettings, songData]); // Re-run only if settings/data change
  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full justify-between flex-wrap gap-4 text-primary dark:text-white rounded-2xl dark:rounded-none mb-4",
        isWrapped && "justify-center gap-6",
      )}
    >
      <div
        className={cn(
          "flex flex-col flex-grow align-middle song-heading",
          isWrapped ? "text-center" : "justify-start",
        )}
      >
        <h2 className="font-semibold text-wrap uppercase dark:text-foreground select-text">
          {songData.artist}
        </h2>
        <h2 className="font-bold text-wrap  dark:text-white select-text">
          {songData.title}
        </h2>
        {note && <p className="text-sm opacity-70 mt-2">{note}</p>}
      </div>
      <div
        className={cn(
          "flex flex-col gap-2",
          isWrapped ? "w-full items-center" : "items-end",
        )}
      >
        <div
          className={cn(
            "flex gap-4 md:gap-6 items-center",
            isWrapped ? "w-full justify-around" : "",
          )}
        >
          <div
            className={cn(
              "flex flex-col dark:text-white/70",
              isWrapped ? "w-fit" : "text-right",
            )}
          >
            {(canEditCapo || capo > 0) && (
              <CapoControl
                capo={capo}
                setCapo={setCapo ?? (() => {})}
                originalCapo={originalCapo}
                editable={canEditCapo}
                className="text-[0.75em] text-nowrap"
              />
            )}
            {songData.externalSource ? ( // external songs won't have range --> safe to replace by import source
              <Link
                className="text-[0.55em] dark:text-white/70"
                to={songData.externalSource.url}
                target="_blank"
              >
                {songData.externalSource &&
                  `Imported from ${SONG_SOURCES_PRETTY[songData.externalSource.sourceId]}`}
              </Link>
            ) : (
              <h3
                className={cn(
                  "text-[0.75em] sub-sup-container",
                  songData.range === undefined ? "opacity-0" : "opacity-100",
                )}
              >
                {songData.range
                  ? formatChords(songData.range.toString(transposeSteps, true))
                  : "undefined"}
              </h3>
            )}
          </div>
          {userData && (
            <FavoriteButton
              song={songData}
              userId={userData.profile.id}
              personalization={songbookPersonalization}
              iconClassName={cn(
                "size-[2em] stroke-[1.5]",
                isWrapped ? "" : "max-w-14",
              )}
              className="p-0"
            />
          )}
        </div>
        {songData.isCustom && (
          <VersionBadge
            icon={canSwitchToCanonical ? RotateCcw : Pencil}
            action={
              canSwitchToCanonical
                ? {
                    label: "Use official version",
                    title: "A newer official version is available — switch to it",
                    onClick: () => switchVersion(null),
                  }
                : undefined
            }
          >
            {draftAuthor ? `${draftAuthor}'s version` : "Your version"}
          </VersionBadge>
        )}
        {ownOtherSubmission && (
          <VersionBadge
            icon={Pencil}
            action={{
              label:
                ownOtherSubmission.status === "pending"
                  ? "View your pending edit"
                  : "View your version",
              title:
                ownOtherSubmission.status === "pending"
                  ? "You have an edit awaiting approval — switch to it"
                  : "You have an older version of this song — switch to it",
              onClick: () => switchVersion(ownOtherSubmission.id),
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SongHeading;
