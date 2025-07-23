import { AutoTextSize } from "auto-text-size";
import { cn } from "~/lib/utils";
import { fetchIllustrationPrompt } from "~/services/songs";
import { useQuery } from "@tanstack/react-query";

interface IllustrationPromptProps {
  song: { id: string };
  show: boolean;
  className?: string;
}

export function IllustrationPrompt({
  song,
  show,
  className,
}: IllustrationPromptProps) {
  const {
    data: promptContent,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["illustrationPrompt", song.id],
    queryFn: () => fetchIllustrationPrompt(song.id),
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
            No prompt available
          </p>
        ) : (
          <p className="text-wrap w-full text-shadow">{promptContent || ""}</p>
        )}
      </AutoTextSize>
    </div>
  );
}
