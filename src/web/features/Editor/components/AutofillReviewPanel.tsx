import React, { useState, useRef, useLayoutEffect } from "react";
import { Check, X, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

const DIFF_VIEWER_STYLES = {
  variables: {
    light: {
      diffViewerBackground: "transparent",
      addedBackground: "#d1fae5",
      addedColor: "#065f46",
      removedBackground: "#fee2e2",
      removedColor: "#991b1b",
      wordAddedBackground: "#6ee7b7",
      wordRemovedBackground: "#fca5a5",
      addedGutterBackground: "#a7f3d0",
      removedGutterBackground: "#fecaca",
      gutterBackground: "hsl(var(--muted))",
      gutterBackgroundDark: "hsl(var(--muted))",
      highlightBackground: "hsl(var(--accent))",
      highlightGutterBackground: "hsl(var(--accent))",
      codeFoldBackground: "hsl(var(--muted))",
      emptyLineBackground: "rgba(0,0,0,0.03)",
      codeFoldContentColor: "hsl(var(--muted-foreground))",
      // Hide the built-in title bar — we render our own column headers
      diffViewerTitleBackground: "transparent",
      diffViewerTitleColor: "transparent",
      diffViewerTitleBorderColor: "transparent",
    },
  },
};

export interface AutofillReviewPanelProps {
  originalContent: string;
  newContent: string;
  onAccept: (editedContent: string) => void;
  onReject: () => void;
}

export const AutofillReviewPanel: React.FC<AutofillReviewPanelProps> = ({
  originalContent,
  newContent,
  onAccept,
  onReject,
}) => {
  const [editedContent, setEditedContent] = useState(newContent);
  const diffScrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);

  // Save scroll position before React re-renders the diff
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (diffScrollRef.current) {
      savedScrollTop.current = diffScrollRef.current.scrollTop;
    }
    setEditedContent(e.target.value);
  };

  // Restore scroll position after the diff re-renders, before paint
  useLayoutEffect(() => {
    if (diffScrollRef.current) {
      diffScrollRef.current.scrollTop = savedScrollTop.current;
    }
  }, [editedContent]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="flex flex-col bg-background border-2 border-primary rounded-lg shadow-2xl w-full max-w-6xl h-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* ── Explanation banner ───────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-muted/40 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-sm">
              Review Autofilled Chords
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            AI has filled in chords for sections that were missing them. Edit
            the result in the text area below — the diff updates live so you can
            spot any unintended changes to lyrics or existing chords.
          </p>
          <div className="flex items-start gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-2 text-xs text-amber-800">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Check carefully:</strong> AI occasionally rewrites a word
              or moves a chord. Red highlights in the diff mean something was
              removed — make sure it's only chord syntax, not lyrics.
            </span>
          </div>
        </div>

        {/* ── Main body: editor left, live diff right ──────────────────── */}
        <div className="flex flex-1 min-h-0 divide-x divide-border">
          {/* Left: editable new content */}
          <div className="flex flex-col w-1/2 min-h-0">
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border shrink-0">
              <span className="text-xs font-medium text-muted-foreground">
                Autofilled result
                <span className="ml-1.5 opacity-60 font-normal">
                  (editable)
                </span>
              </span>
              <button
                onClick={() => setEditedContent(newContent)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                title="Reset to AI output"
              >
                Reset
              </button>
            </div>
            <textarea
              value={editedContent}
              onChange={handleChange}
              className="flex-1 w-full resize-none p-3 font-mono text-xs focus:outline-none focus:bg-primary/5 transition-colors overflow-y-auto"
              spellCheck={false}
              autoFocus
            />
          </div>

          {/* Right: live inline diff */}
          <div className="flex flex-col w-1/2 min-h-0 overflow-hidden">
            <div className="text-xs font-medium text-muted-foreground bg-muted/30 border-b border-border shrink-0 px-3 py-1.5">
              Live diff
            </div>
            <div
              ref={diffScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden text-xs
              [&_table]:w-full [&_table]:table-fixed
              [&_td]:break-words [&_td]:whitespace-pre-wrap
              [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:overflow-hidden"
            >
              <ReactDiffViewer
                oldValue={originalContent}
                newValue={editedContent}
                splitView={false}
                compareMethod={DiffMethod.WORDS}
                hideLineNumbers={false}
                useDarkTheme={false}
                styles={DIFF_VIEWER_STYLES}
              />
            </div>
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            className="gap-1.5"
          >
            <X className="size-3.5" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(editedContent)}
            className="gap-1.5"
          >
            <Check className="size-3.5" />
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
};
