import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import client from "src/worker/api-client";
import { useIsOnline } from "~/hooks/use-is-online";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";

interface FavoriteButtonProps {
  song: SongData;
  userId: string;
  className?: string;
  iconClassName?: string;
}

export const FavoriteButton = ({
  song,
  userId,
  className = "",
  iconClassName = "h-6 w-6",
}: FavoriteButtonProps) => {
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const isFavorite = song.isFavorite;

  const queryKey = ["favorites", userId];

  // Mutation for adding favorite
  const addFavoriteMutation = useMutation({
    mutationFn: () => client.api.favorites.$post({ json: { songId: song.id } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousFavorites = queryClient.getQueryData<string[]>(queryKey);

      queryClient.setQueryData<string[]>(queryKey, (old = []) => {
        if (old.includes(song.id)) return old;
        return [...old, song.id];
      });

      return { previousFavorites };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKey, context.previousFavorites);
      }
      toast.error("Failed to add favorite");
    },
  });

  // Mutation for removing favorite
  const removeFavoriteMutation = useMutation({
    mutationFn: () => client.api.favorites.$delete({ json: { songId: song.id } }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });

      const previousFavorites = queryClient.getQueryData<string[]>(queryKey);

      queryClient.setQueryData<string[]>(queryKey, (old = []) => {
        return old.filter((id) => id !== song.id);
      });

      return { previousFavorites };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(queryKey, context.previousFavorites);
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
