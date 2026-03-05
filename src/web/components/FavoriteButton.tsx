import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FavoritesAPI } from "src/worker/api-client";
import { useIsOnline } from "~/hooks/use-is-online";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";

interface FavoriteButtonProps {
  song: SongData;
  favoritesApi: FavoritesAPI;
  className?: string;
  iconClassName?: string;
}

export const FavoriteButton = ({
  song,
  favoritesApi,
  className = "",
  iconClassName = "h-6 w-6",
}: FavoriteButtonProps) => {
  const [isFavorite, setIsFavorite] = useState(song.isFavorite);
  const queryClient = useQueryClient();

  // Mutation for adding favorite
  const addFavoriteMutation = useMutation({
    mutationFn: () => favoritesApi.$post({ json: { songId: song.id } }),
    onMutate: () => {
      // Store previous state for rollback
      const previousState = song.isFavorite;

      // Optimistically update
      song.isFavorite = true;
      setIsFavorite(true);

      return { previousState };
    },
    onSuccess: () => {
      // Update the cache directly instead of invalidating
      queryClient.setQueryData(["userProfile"], (oldData: any) => {
        if (!oldData || !oldData.loggedIn) return oldData;

        return {
          ...oldData,
          profile: {
            ...oldData.profile,
            favoriteSongIds: [...oldData.profile.favoriteSongIds, song.id],
          },
        };
      });
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousState !== undefined) {
        song.isFavorite = context.previousState;
        setIsFavorite(context.previousState);
      }
      toast.error("Failed to add favorite");
    },
  });

  // Mutation for removing favorite
  const removeFavoriteMutation = useMutation({
    mutationFn: () => favoritesApi.$delete({ json: { songId: song.id } }),
    onMutate: () => {
      const previousState = song.isFavorite;

      song.isFavorite = false;
      setIsFavorite(false);

      return { previousState };
    },
    onSuccess: () => {
      // Update the cache directly instead of invalidating
      queryClient.setQueryData(["userProfile"], (oldData: any) => {
        if (!oldData || !oldData.loggedIn) return oldData;

        return {
          ...oldData,
          profile: {
            ...oldData.profile,
            favoriteSongIds: oldData.profile.favoriteSongIds.filter(
              (id: string) => id !== song.id,
            ),
          },
        };
      });
    },
    onError: (_error, _variables, context) => {
      if (context?.previousState !== undefined) {
        song.isFavorite = context.previousState;
        setIsFavorite(context.previousState);
      }
      toast.error("Failed to remove favorite");
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isFavorite) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  const isLoading =
    addFavoriteMutation.isPending || removeFavoriteMutation.isPending;
  const isOnline = useIsOnline();
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading || !isOnline}
      className={cn(
        "favorite-button flex items-center justify-center p-2 transition-transform hover:scale-110",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        className,
      )}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
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
