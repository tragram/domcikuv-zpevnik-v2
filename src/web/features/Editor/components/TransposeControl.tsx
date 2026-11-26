import { Minus, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { EditorInfo } from "./EditorInfo";

interface TransposeControlProps {
  content: string;
  isProcessing: boolean;
  onTranspose: (steps: -1 | 1) => void;
}

export default function TransposeControl({ content, isProcessing, onTranspose }: TransposeControlProps) {
  const hasChords = /\[[A-H][A-Za-z\d#b,\s/]*\]/.test(content);
  const disabled = !hasChords || isProcessing;
  const label = isProcessing && hasChords ? "Transposing..." : "Transpose Chords";
  return (
    <div role="group" aria-label={label} className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide">{label}</span>
        <EditorInfo label="Transpose Chords">
          <div>Move all chords down or up one semitone per press.</div>
          {!hasChords && <p className="font-medium text-foreground">No chords detected to transpose.</p>}
        </EditorInfo>
      </div>
      <div className="grid h-10 grid-cols-2 overflow-hidden rounded-md border border-border bg-control-surface [&>button]:h-full">
        <Button type="button" variant="ghost" size="sm" className="rounded-none border-r border-border shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2" disabled={disabled} aria-label="Transpose down one semitone"
          onMouseDown={event => event.preventDefault()} onClick={() => onTranspose(-1)}>
          <Minus aria-hidden className="size-4" /> Down
        </Button>
        <Button type="button" variant="ghost" size="sm" className="rounded-none shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2" disabled={disabled} aria-label="Transpose up one semitone"
          onMouseDown={event => event.preventDefault()} onClick={() => onTranspose(1)}>
          <Plus aria-hidden className="size-4" /> Up
        </Button>
      </div>
    </div>
  );
}
