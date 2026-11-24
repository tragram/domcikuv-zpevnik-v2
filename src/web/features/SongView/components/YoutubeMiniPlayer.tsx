import { useDrag } from "@use-gesture/react";
import { GripHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { youtubeEmbedUrl } from "src/lib/youtube";
import { Button } from "~/components/ui/button";

interface YoutubeMiniPlayerProps {
  youtubeId: string;
  onClose: () => void;
}

type Position = [left: number, top: number];

function clampPosition([left, top]: Position, player: HTMLDivElement): Position {
  const { clientWidth, clientHeight } = document.documentElement;
  return [
    Math.max(0, Math.min(left, clientWidth - player.offsetWidth)),
    Math.max(0, Math.min(top, clientHeight - player.offsetHeight)),
  ];
}

// A real OS-level Picture-in-Picture window can't host a YouTube iframe:
// Document Picture-in-Picture windows never send a Referer header on their
// requests (a known, wontfix browser limitation), and YouTube's embedded
// player now rejects playback without one (error 153). So this floats the
// player in-page instead, which keeps the normal page referrer intact.
export const YoutubeMiniPlayer = ({
  youtubeId,
  onClose,
}: YoutubeMiniPlayerProps) => {
  const playerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>();
  const bindDrag = useDrag(
    ({ event, offset }) => {
      if (event.type === "keydown") event.preventDefault();
      const player = playerRef.current;
      if (player) setPosition(clampPosition(offset, player));
    },
    {
      from: () => {
        const rect = playerRef.current?.getBoundingClientRect();
        return rect ? [rect.left, rect.top] : [0, 0];
      },
    },
  );

  useEffect(() => {
    const keepPlayerVisible = () => {
      const player = playerRef.current;
      if (player) {
        setPosition((current) => current && clampPosition(current, player));
      }
    };
    window.addEventListener("resize", keepPlayerVisible);
    return () => window.removeEventListener("resize", keepPlayerVisible);
  }, []);

  return (
    <div
      ref={playerRef}
      className="fixed bottom-6 left-6 z-50 w-72 max-w-[calc(100%-3rem)] overflow-hidden rounded-lg bg-background shadow-xl"
      style={position && { left: position[0], top: position[1], bottom: "auto" }}
    >
      <div className="flex h-9 items-center gap-1 pr-1">
        <button
          {...bindDrag()}
          type="button"
          className="flex h-full flex-1 touch-none cursor-grab select-none items-center justify-center pl-7 text-muted-foreground active:cursor-grabbing focus-visible:outline-2 focus-visible:-outline-offset-2"
          aria-label="Move video with arrow keys"
          title="Drag to move video"
        >
          <GripHorizontal aria-hidden="true" className="pointer-events-none size-4" />
        </button>
        <Button
          type="button"
          size="icon"
          variant="circular"
          className="size-6"
          onClick={onClose}
          aria-label="Close video"
          title="Close video"
        >
          <X className="size-3" />
        </Button>
      </div>
      <iframe
        className="block aspect-video w-full"
        src={youtubeEmbedUrl(youtubeId)}
        title="YouTube video player"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};
