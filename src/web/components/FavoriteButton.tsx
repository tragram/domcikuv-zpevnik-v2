import { PopoverClose } from "@radix-ui/react-popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Asterisk, Heart } from "lucide-react";
import { toast } from "sonner";
import client from "src/worker/api-client";
import type { SongbookEntryApi } from "src/worker/api/api-types";
import { useIsOnline } from "~/hooks/use-is-online";
import { useSaveSongbookVersion } from "~/hooks/use-save-songbook-version";
import { makeApiRequest } from "~/services/api-service";
import {
  addFavoriteEntry,
  favoritesQueryOptions,
  removeFavoriteEntry,
  useSongbookEntry,
} from "~/hooks/use-user-data";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { songPanelClassName } from "~/features/SongView/components/songPanel";
import { KeyCapo } from "~/features/SongView/hooks/songTransposeMath";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

const songbookActionClassName = "h-auto min-h-8 min-w-0 rounded-full bg-control-surface px-2 py-1 text-center text-xs leading-tight whitespace-normal text-primary hover:bg-control-hover focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Shared add/remove-favorite mutation with optimistic cache updates. Used by
 * both the heart button and the "songbook" menu entry, so the toggle behaves
 * identically wherever it's triggered.
 */
export function useToggleFavorite(
  song: SongData,
  userId: string,
  // Key/capo to capture when the song is added to the songbook (e.g. from the
  // song view). Omitted in lists, where the song is added with no override.
  personalization?: KeyCapo,
) {
  const queryClient = useQueryClient();
  const queryKey = favoritesQueryOptions(userId).queryKey;

  // Membership is read from the live favorites cache (not the song's frozen
  // loader snapshot), so revalidation and optimistic changes update the heart
  // immediately.
  const { entry, isFavorite } = useSongbookEntry(song.id, userId, song.isFavorite);

  // Both the song heart and the version picker save the displayed version ID.
  const pinnedVersionId = song.versionId;

  const addFavorite = useMutation({
    mutationFn: () => makeApiRequest(() =>
      client.api.favorites.$post({
        json: { songId: song.id, ...(personalization ?? {}), pinnedVersionId },
      }),
    ),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SongbookEntryApi[]>(queryKey);
      addFavoriteEntry(queryClient, userId, {
        songId: song.id,
        pinnedVersionId: pinnedVersionId ?? null,
        keyIndex: personalization?.keyIndex ?? null,
        capo: personalization?.capo ?? null,
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error("Failed to add to songbook");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey, refetchType: "all" }),
  });

  const removeFavorite = useMutation({
    mutationFn: () => client.api.favorites.$delete({ json: { songId: song.id } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SongbookEntryApi[]>(queryKey);
      removeFavoriteEntry(queryClient, userId, song.id);
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
      toast.error("Failed to remove from songbook");
    },
  });

  return {
    isFavorite,
    pinnedVersionId: entry?.pinnedVersionId,
    isLoading: addFavorite.isPending || removeFavorite.isPending,
    toggle: () =>
      isFavorite ? removeFavorite.mutate() : addFavorite.mutate(),
  };
}

interface FavoriteButtonProps {
  song: SongData;
  userId: string;
  className?: string;
  iconClassName?: string;
  showSavedVersionPrompt?: boolean;
  canSaveDisplayedVersion?: boolean;
  // Key/capo to capture when adding to the songbook (song view only).
  personalization?: KeyCapo;
}

export const FavoriteButton = ({
  song,
  userId,
  className = "",
  iconClassName = "h-6 w-6",
  showSavedVersionPrompt = false,
  canSaveDisplayedVersion = true,
  personalization,
}: FavoriteButtonProps) => {
  const isOnline = useIsOnline();
  const { isFavorite, pinnedVersionId, isLoading, toggle } = useToggleFavorite(
    song,
    userId,
    personalization,
  );
  const savedVersionId = showSavedVersionPrompt && pinnedVersionId !== song.versionId
    ? pinnedVersionId
    : undefined;
  const controlClassName = cn(
    "favorite-button relative flex items-center justify-center p-2",
    className,
  );

  if (savedVersionId) {
    const label = "A different version is saved in your songbook";
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cn(controlClassName, "group/favorite")} title={label} aria-label={label}>
            <span aria-hidden="true" className="pointer-events-none relative flex motion-safe:transition-transform motion-safe:group-hover/favorite:scale-110">
              <Heart className={cn(iconClassName, "text-primary")} />
              <Asterisk className="absolute right-0 top-0 size-[0.85em] rounded-full bg-background p-px text-primary" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={12}
          collisionPadding={16}
          container={typeof document === "undefined" ? undefined : document.fullscreenElement}
          aria-label="Saved songbook version"
          className={cn(songPanelClassName, "w-80 max-w-[calc(100vw-2rem)] space-y-2.5 p-3 text-sm font-normal")}
        >
          <p>Your songbook has a different version of this song.</p>
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            <PopoverClose asChild>
              <Button asChild size="sm" variant="ghost" className={songbookActionClassName}>
                <Link to="/song/$songId" params={{ songId: song.id }} search={{ version: savedVersionId }}>
                  View saved version
                </Link>
              </Button>
            </PopoverClose>
            {canSaveDisplayedVersion && song.versionId && (
              <SaveDisplayedVersionButton songId={song.id} userId={userId} versionId={song.versionId} isOnline={isOnline} />
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const label = !isOnline
    ? "Unavailable offline"
    : isFavorite
      ? "Remove from favorites"
      : "Add to favorites";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={isLoading || !isOnline}
      className={cn(
        controlClassName,
        "transition-transform hover:scale-110",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
      )}
      title={label}
      aria-label={label}
    >
      <Heart
        aria-hidden="true"
        className={cn(
          "transition-colors",
          iconClassName,
          isLoading && "animate-pulse",
          isFavorite
            ? "fill-primary text-primary"
            : "hover:text-primary text-white/70",
        )}
      />
    </button>
  );
};

function SaveDisplayedVersionButton({ songId, userId, versionId, isOnline }: {
  songId: string;
  userId: string;
  versionId: string;
  isOnline: boolean;
}) {
  const save = useSaveSongbookVersion(songId, userId);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={cn(songbookActionClassName, "bg-primary/15")}
      disabled={!isOnline || save.isPending}
      aria-busy={save.isPending}
      onClick={() => save.mutate(versionId)}
    >
      {save.isPending ? "Saving…" : "Save this version"}
    </Button>
  );
}
