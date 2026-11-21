import { ExternalLink, Globe } from "lucide-react";
import { SONG_SOURCES, SONG_SOURCES_PRETTY } from "src/lib/contracts/song-sources";
import { Badge } from "~/components/ui/badge";

interface ExternalSourceBadgeProps {
  sourceId: (typeof SONG_SOURCES)[number];
  url: string;
  className?: string;
}

/**
 * Linked badge marking a song as imported from an external source. Stops click
 * propagation so it can live inside clickable/expandable table rows.
 */
export function ExternalSourceBadge({
  sourceId,
  url,
  className,
}: ExternalSourceBadgeProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Imported from ${SONG_SOURCES_PRETTY[sourceId]}`}
      className={className}
    >
      <Badge
        variant="outline"
        className="bg-info/10 text-info border-info/30 hover:bg-info/20"
      >
        <Globe className="w-3 h-3 mr-1" />
        {SONG_SOURCES_PRETTY[sourceId]}
        <ExternalLink className="w-3 h-3 ml-1 opacity-60" />
      </Badge>
    </a>
  );
}
