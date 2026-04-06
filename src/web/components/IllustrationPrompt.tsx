import { useQuery } from "@tanstack/react-query";
import { AutoTextSize } from "auto-text-size";
import { SongsAPI } from "src/worker/api-client";
import { useIsOnline } from "~/hooks/use-is-online";
import { cn } from "~/lib/utils";
import { fetchIllustrationPrompt } from "~/services/illustration-service";
import { SongData } from "~/types/songData";

interface IllustrationPromptProps {
  song: SongData;
  show: boolean;
  songsAPI: SongsAPI;
  className?: string;
}

export function IllustrationPrompt({
  song,
  show,
  songsAPI,
  className,
}: IllustrationPromptProps) {
  const {
    data: promptContent,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["illustrationPrompt", song.currentIllustration?.promptId],
    queryFn: () => fetchIllustrationPrompt(songsAPI, song),
    enabled: show,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  const isOnline = useIsOnline();
  if (!show) {
    return null;
  }

  let text = promptContent ?? "";
  if (!isOnline && !promptContent) {
    text =
      "You must be online to see full resolution illustrations and their prompts.";
  } else if (error) {
    text = "No description available";
  }

  return (
    <div className={cn("px-4 flex flex-grow my-4 w-full", className)}>
      <AutoTextSize mode="boxoneline" maxFontSizePx={40}>
        <p className="text-wrap w-full text-shadow">{text}</p>
      </AutoTextSize>
    </div>
  );
}
