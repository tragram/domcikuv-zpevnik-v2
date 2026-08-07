import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useSongLayoutPressure } from "./use-song-width-metrics";

interface SongMaxWidthProps {
  versionId: string;
  chordpro: string;
}

export function SongMaxWidth({
  versionId,
  chordpro,
}: SongMaxWidthProps) {
  const pressure = useSongLayoutPressure(versionId, chordpro);

  if (!pressure) {
    return (
      <span className="font-mono text-sm tabular-nums text-muted-foreground/50">
        —
      </span>
    );
  }

  const width = pressure.widestRowEm.toFixed(1);
  const description = `${width} em widest row, approximately ${pressure.visibleRows} visible rows`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex min-w-16 items-baseline gap-1 whitespace-nowrap rounded px-1.5 py-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={description}
        >
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground/90">
            {width}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            em
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm space-y-1">
        <p>{description}</p>
        {pressure.widestLine && (
          <p className="truncate opacity-80">
            Widest: {pressure.widestLine}
          </p>
        )}
        <p className="opacity-70">
          Proportional-font estimate; scrollable tabs, wrapping comments, and
          screen layout are not included.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
