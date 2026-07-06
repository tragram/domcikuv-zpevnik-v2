import { X } from "lucide-react";
import { youtubeEmbedUrl } from "src/lib/youtube";
import { Button } from "~/components/ui/button";

interface YoutubeMiniPlayerProps {
  youtubeId: string;
  onClose: () => void;
}

// A real OS-level Picture-in-Picture window can't host a YouTube iframe:
// Document Picture-in-Picture windows never send a Referer header on their
// requests (a known, wontfix browser limitation), and YouTube's embedded
// player now rejects playback without one (error 153). So this floats the
// player in-page instead, which keeps the normal page referrer intact.
export const YoutubeMiniPlayer = ({
  youtubeId,
  onClose,
}: YoutubeMiniPlayerProps) => (
  <div className="fixed bottom-6 left-6 z-50 w-72 overflow-hidden rounded-lg shadow-xl">
    <Button
      size="icon"
      variant="circular"
      className="absolute right-1 top-1 z-10 h-6 w-6"
      onClick={onClose}
      title="Close video"
    >
      <X className="h-3 w-3" />
    </Button>
    <iframe
      className="aspect-video w-full"
      src={youtubeEmbedUrl(youtubeId)}
      title="YouTube video player"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  </div>
);
