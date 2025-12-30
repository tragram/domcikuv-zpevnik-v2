import { AutoTextSize } from "auto-text-size";
import { cn } from "~/lib/utils";
import { fetchIllustrationPrompt } from "~/services/songs";
import { useQuery } from "@tanstack/react-query";
import { SongData } from "~/types/songData";
import { useRouteContext } from "@tanstack/react-router";

interface IllustrationPromptProps {
  song: SongData;
  show: boolean;
  className?: string;
}

export function IllustrationPrompt({
  song,
  show,
  className,
}: IllustrationPromptProps) {
  const routeContext = useRouteContext({ from: "/gallery" });
  const {
    data: promptContent,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["illustrationPrompt", song.currentIllustration?.promptId],
    queryFn: () => fetchIllustrationPrompt(routeContext.api.songs, song),
    enabled: show,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  if (!show) {
    return null;
  }

  return (
    <div className={cn("px-4 flex flex-grow my-4 w-full", className)}>
      <AutoTextSize mode="boxoneline">
        {isLoading ? (
          <p className="text-wrap w-full text-shadow opacity-50"></p>
        ) : error ? (
          <p className="text-wrap w-full text-shadow opacity-50">
            No description available
          </p>
        ) : (
          <p className="text-wrap w-full text-shadow">{promptContent || ""}</p>
        )}
      </AutoTextSize>
    </div>
  );
}
