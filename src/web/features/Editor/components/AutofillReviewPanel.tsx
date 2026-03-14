import React, { useState } from "react";
import { Check, X, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";

// Import both the standard editor and the merge wrapper
import CodeMirror from "@uiw/react-codemirror";
import CodeMirrorMerge from "react-codemirror-merge";

// Import the unified view extension directly from the core package
import { unifiedMergeView } from "@codemirror/merge";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { chordProExtensions, transparentTheme } from "../ContentEditor";

const { Original, Modified } = CodeMirrorMerge;

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

        {/* ── DESKTOP: Side-by-Side Merge View ─────────────────────────── */}
        <div className="hidden md:flex flex-col flex-1 min-h-0 bg-background">
          <div className="flex items-center divide-x divide-border border-b border-border bg-muted/30 shrink-0">
            {/* Headers swapped: Original is now on the left */}
            <div className="w-1/2 px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Original content
              </span>
            </div>
            <div className="flex items-center justify-between w-1/2 px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Autofilled result{" "}
                <span className="ml-1.5 opacity-60 font-normal">
                  (editable)
                </span>
              </span>
              <button
                onClick={() => setEditedContent(newContent)}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden font-mono text-xs [&_.cm-mergeView]:h-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto">
            {/* Removed orientation prop to default to Original -> Modified */}
            <CodeMirrorMerge theme={transparentTheme} className="h-full">
              <Original
                value={originalContent}
                extensions={[
                  ...chordProExtensions,
                  EditorView.editable.of(false),
                  EditorState.readOnly.of(true),
                ]}
              />
              <Modified
                value={editedContent}
                onChange={setEditedContent}
                extensions={chordProExtensions}
              />
            </CodeMirrorMerge>
          </div>
        </div>

        {/* ── MOBILE: Unified / Inline Diff View ───────────────────────── */}
        <div className="flex md:hidden flex-col flex-1 min-h-0 bg-background">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 shrink-0 px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Inline Diff{" "}
              <span className="ml-1.5 opacity-60 font-normal">(editable)</span>
            </span>
            <button
              onClick={() => setEditedContent(newContent)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Reset
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden font-mono text-xs">
            {/* Standard CodeMirror but with the unifiedMergeView extension */}
            <CodeMirror
              value={editedContent}
              onChange={setEditedContent}
              theme={transparentTheme}
              extensions={[
                ...chordProExtensions,
                unifiedMergeView({
                  original: originalContent,
                }),
              ]}
              className="h-full w-full outline-none [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
            />
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
