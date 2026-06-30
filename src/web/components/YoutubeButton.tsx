import { Play}  from "lucide-react";
import { youtubeWatchUrl } from "src/lib/youtube";
import { cn } from "~/lib/utils";

interface YoutubeButtonProps {
  youtubeId: string;
  className?: string;
}

export const YoutubeButton = ({
  youtubeId,
  className = "",
}: YoutubeButtonProps) => (
  <button
    type="button"
    onClick={(e) => {
      // The whole row is a Link; intercept so the icon opens the video
      // in a new tab instead of navigating to the song (same pattern as
      // FavoriteButton).
      e.preventDefault();
      e.stopPropagation();
      window.open(youtubeWatchUrl(youtubeId), "_blank", "noopener,noreferrer");
    }}
    className={cn(
      "flex shrink-0 items-center justify-center p-2 transition-transform hover:scale-110",
      className,
    )}
    title="Watch on YouTube"
    aria-label="Watch on YouTube"
  >
    <Play className="h-5 w-5 text-white/70 hover:text-primary" />
  </button>
);
