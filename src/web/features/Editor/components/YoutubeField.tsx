import { ExternalLink, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useIsOnline } from "~/hooks/use-is-online";
import {
  parseYoutubeId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "src/lib/youtube";
import { searchYoutube } from "~/services/editor-service";
import { Button } from "~/components/ui/button";
import MetadataField from "./MetadataField";

interface YoutubeFieldProps {
  value?: string;
  onChange: (value: string) => void;
  /** Used to build the auto-search query. */
  title: string;
  artist: string;
  modified: boolean;
  error?: string;
}

const YoutubeField: React.FC<YoutubeFieldProps> = ({
  value,
  onChange,
  title,
  artist,
  modified,
  error,
}) => {
  const isOnline = useIsOnline();
  const [isSearching, setIsSearching] = useState(false);

  const query = `${artist} ${title}`.trim();
  const canSearch = isOnline && query.length > 1 && !isSearching;
  const videoId = parseYoutubeId(value);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const result = await searchYoutube(query);
      if (result) {
        onChange(result.id);
        toast.success(`Found: ${result.title}`);
      } else {
        toast.info("No video found for this title and artist.");
      }
    } catch (e) {
      console.error("YouTube search failed:", e);
      // The worker returns a user-facing message (e.g. quota reached); show it.
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : "YouTube search failed. Please try again.",
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <MetadataField
        label="YouTube"
        onChange={onChange}
        placeholder="Paste a link or auto-search"
        value={value}
        modified={modified}
        description="Link to a YouTube video. Use Auto-search to find it from the title and artist."
        error={error}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 grow"
            disabled={!canSearch}
            onClick={handleSearch}
            title={
              !isOnline
                ? "You're offline — search needs an internet connection."
                : query.length <= 1
                  ? "Enter a title and artist first."
                  : "Find the first matching video on YouTube"
            }
          >
            {isSearching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {/* Icon-only on phones to keep the field compact; labelled on wider screens. */}
            <span className="hidden sm:inline">Auto-search</span>
          </Button>
        }
      />
      {videoId && (
        <a
          href={youtubeWatchUrl(videoId)}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-1.5 hover:bg-primary/10"
        >
          <img
            src={youtubeThumbnailUrl(videoId)}
            alt="Video thumbnail"
            className="h-9 w-16 shrink-0 rounded object-cover"
          />
          <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-primary/80 group-hover:text-primary">
            <ExternalLink className="h-3 w-3 shrink-0" />
            Open on YouTube
          </span>
        </a>
      )}
    </div>
  );
};

export default YoutubeField;
