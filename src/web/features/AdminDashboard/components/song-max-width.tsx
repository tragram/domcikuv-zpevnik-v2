import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useSongLayoutPressure } from "./use-song-width-metrics";

interface SongMaxWidthProps {
  versionId: string;
  chordpro: string;
  metric?: "width" | "opportunity";
}

export function SongMaxWidth({
  versionId,
  chordpro,
  metric = "width",
}: SongMaxWidthProps) {
  const pressure = useSongLayoutPressure(versionId, chordpro);
  const opportunity = pressure?.widthOpportunity;

  if (!pressure || (metric === "opportunity" && !opportunity)) {
    return (
      <span
        className="font-mono text-sm tabular-nums text-muted-foreground/50"
        aria-label={pressure ? "No standout lines" : "Layout estimate unavailable"}
      >
        —
      </span>
    );
  }

  if (metric === "opportunity" && opportunity) {
    const reduction = Math.round(opportunity.reductionPercent);
    const lineCount = opportunity.lines.length;
    const lines = `${lineCount} ${lineCount === 1 ? "line" : "lines"}`;
    const description = `${reduction}% narrower by shortening ${lines}`;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex items-baseline gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={description}
          >
            <span className="font-mono text-sm font-semibold tabular-nums">
              −{reduction}%
            </span>
            <span className="text-xs text-muted-foreground">{lines}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm space-y-1">
          <p>{description} to {opportunity.targetWidthEm.toFixed(1)} em or less.</p>
          <ul className="space-y-1 opacity-80">
            {opportunity.lines.map((line) => (
              <li key={line.number} className="wrap-anywhere">
                Line {line.number} · {line.text}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
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
          Estimated from the source with inline chords and collapsed recalls.
          The actual fit also depends on section labels and screen layout.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
