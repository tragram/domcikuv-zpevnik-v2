import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import client from "src/worker/api-client";
import { SongbookEntryApi } from "src/worker/api/api-types";
import { useIsOnline } from "~/hooks/use-is-online";
import {
  addFavoriteEntry,
  favoritesQueryOptions,
  removeFavoriteEntry,
  useSongbookEntry,
} from "~/hooks/use-user-data";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { KeyCapo } from "~/features/SongView/hooks/songTransposeMath";

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
  // loader snapshot), so optimistic adds/removes flip the heart immediately and
  // the toggle always picks the right direction.
  const { isFavorite } = useSongbookEntry(song.id, userId, song.isFavorite);

  // Liking a draft (a non-canonical version on screen — e.g. another user's
  // pending edit) pins that exact version, so it keeps showing in the songbook.
  // Imported external versions are never pinned: their curated version is always
  // the better one to fall back to.
  const pinnedVersionId =
    song.isCustom && !song.externalSource ? song.versionId : undefined;

  const addFavorite = useMutation({
    mutationFn: () =>
      client.api.favorites.$post({
        json: { songId: song.id, ...(personalization ?? {}), pinnedVersionId },
      }),
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
  // Key/capo to capture when adding to the songbook (song view only).
  personalization?: KeyCapo;
}

export const FavoriteButton = ({
  song,
  userId,
  className = "",
  iconClassName = "h-6 w-6",
  personalization,
}: FavoriteButtonProps) => {
  const isOnline = useIsOnline();
  const { isFavorite, isLoading, toggle } = useToggleFavorite(
    song,
    userId,
    personalization,
  );

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
        "favorite-button flex items-center justify-center p-2 transition-transform hover:scale-110",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        className,
      )}
      title={
        !isOnline
          ? "Unavailable offline"
          : isFavorite
            ? "Remove from favorites"
            : "Add to favorites"
      }
    >
      <Heart
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
