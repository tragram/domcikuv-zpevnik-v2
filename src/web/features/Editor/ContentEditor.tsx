import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { isConvertibleFormat } from "~/lib/chords2chordpro";
import { cn } from "~/lib/utils";
import "./Editor.css";
import { AutofillReviewPanel } from "./components/AutofillReviewPanel";
import {
  SnippetButton,
  SnippetButtonSection,
  snippets,
} from "./components/Snippets";

// --- CUSTOM CHORDPRO SYNTAX HIGHLIGHTING ---
// 1. Highlight Chords: e.g. [Am7]
const chordMatcher = new MatchDecorator({
  regexp: /\[(.*?)\]/g,
  decoration: Decoration.mark({
    class: "text-primary font-bold rounded px-0.5",
  }),
});

export const chordPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = chordMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = chordMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// 2. Highlight Directives: e.g. {start_of_chorus}
const metadataMatcher = new MatchDecorator({
  regexp:
    /\{(?:title|t|artist|capo|key|tempo|language|range|startmelody)\s*:.*?\}/gi,
  decoration: Decoration.mark({
    // Using opacity and muted text to visually "grey out" the metadata
    class: "opacity-50 text-muted-foreground",
  }),
});

export const metadataPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = metadataMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = metadataMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

const directiveMatcher = new MatchDecorator({
  // Uses negative lookahead to match any {...} that is NOT a metadata key
  regexp:
    /\{(?!(?:title|t|artist|capo|key|tempo|language|range|startmelody)\s*:)(.*?)\}/gi,
  decoration: Decoration.mark({
    class: "text-primary/70 bg-primary/5 font-semibold",
  }),
});

export const directivePlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = directiveMatcher.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = directiveMatcher.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);
export const chordProExtensions = [
  chordPlugin,
  metadataPlugin,
  directivePlugin,
  EditorView.lineWrapping,
];

export const transparentTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important",
    height: "100%",
    color: "inherit",
  },
  ".cm-content": {
    padding: "0.5rem 0",
    fontFamily: "inherit",
    caretColor: "currentColor",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  // Makes the CodeMirror custom cursor visible by inheriting text color
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "currentColor",
  },
  // Bulletproof selection highlight
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "rgba(130, 170, 255, 0.3) !important",
    },
  ".cm-selectionMatch": {
    backgroundColor: "rgba(130, 170, 255, 0.2) !important",
  },
});

export interface ContentEditorRef {
  replaceContentWithUndo: (newContent: string) => void;
}

interface ContentEditorProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
  pendingAutofill: { originalContent: string; newContent: string } | null;
  isProcessing: boolean;
  onAcceptAutofill: (editedContent: string) => void;
  onRejectAutofill: () => void;
}

const ContentEditor = forwardRef<ContentEditorRef, ContentEditorProps>(
  (
    {
      editorContent,
      setEditorContent,
      pendingAutofill,
      isProcessing,
      onAcceptAutofill,
      onRejectAutofill,
    },
    ref,
  ) => {
    const cmRef = useRef<ReactCodeMirrorRef>(null);

    useImperativeHandle(ref, () => ({
      replaceContentWithUndo: (newContent: string) => {
        const view = cmRef.current?.view;
        if (!view) {
          setEditorContent(newContent);
          return;
        }

        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: newContent },
          selection: { anchor: 0 },
          scrollIntoView: true,
        });
      },
    }));

    const insertSnippet = (snippetKey: keyof typeof snippets) => {
      const view = cmRef.current?.view;
      if (!view || !snippets[snippetKey]) return;

      const snippet = snippets[snippetKey];
      const selection = view.state.selection.main;
      const selectedText = view.state.sliceDoc(selection.from, selection.to);

      const textToInsert = snippet.template(selectedText ?? "");

      const finalCursorPos = selectedText
        ? selection.from + textToInsert.length
        : selection.from + snippet.cursorOffset;

      view.dispatch({
        changes: {
          from: selection.from,
          to: selection.to,
          insert: textToInsert,
        },
        selection: { anchor: finalCursorPos },
        scrollIntoView: true,
      });

      view.focus();
    };

    return (
      <div className="flex flex-col h-full min-h-0">
        {pendingAutofill && (
          <AutofillReviewPanel
            originalContent={pendingAutofill.originalContent}
            newContent={pendingAutofill.newContent}
            onAccept={onAcceptAutofill}
            onReject={onRejectAutofill}
          />
        )}

        <div className="flex flex-col h-full min-w-0 w-full">
          <div className="w-full flex flex-wrap gap-1 border-b-4 md:border-b-8 border-primary mt-1 md:mt-0">
            <SnippetButtonSection label="Environments">
              <SnippetButton snippetKey="verse_env" onInsert={insertSnippet} />
              <SnippetButton snippetKey="bridge_env" onInsert={insertSnippet} />
              <SnippetButton snippetKey="chorus_env" onInsert={insertSnippet} />
              <SnippetButton snippetKey="tab_env" onInsert={insertSnippet} />
            </SnippetButtonSection>
            <SnippetButtonSection label="Recalls">
              <SnippetButton
                snippetKey="verse_recall"
                onInsert={insertSnippet}
              />
              <SnippetButton
                snippetKey="bridge_recall"
                onInsert={insertSnippet}
              />
              <SnippetButton
                snippetKey="chorus_recall"
                onInsert={insertSnippet}
              />
            </SnippetButtonSection>
            <SnippetButtonSection label="Variants">
              <SnippetButton
                snippetKey="prepend_content"
                onInsert={insertSnippet}
              />
              <SnippetButton
                snippetKey="replace_first_line"
                onInsert={insertSnippet}
              />
              <SnippetButton
                snippetKey="replace_last_line"
                onInsert={insertSnippet}
              />
              <SnippetButton
                snippetKey="append_content"
                onInsert={insertSnippet}
              />
            </SnippetButtonSection>
            <SnippetButtonSection label="Misc">
              <SnippetButton snippetKey="comment" onInsert={insertSnippet} />
              <SnippetButton snippetKey="repetition" onInsert={insertSnippet} />
              <SnippetButton snippetKey="chords" onInsert={insertSnippet} />
            </SnippetButtonSection>
          </div>

          <div
            className={cn(
              "flex-grow overflow-hidden bg-transparent main-container",
              isConvertibleFormat(editorContent) ? "font-mono" : "font-normal",
            )}
          >
            <CodeMirror
              ref={cmRef}
              value={editorContent}
              onChange={(value) => setEditorContent(value)}
              readOnly={isProcessing}
              theme={transparentTheme}
              extensions={chordProExtensions}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightSelectionMatches: true,
              }}
              className="h-full w-full outline-none text-base"
            />
          </div>
        </div>
      </div>
    );
  },
);

ContentEditor.displayName = "ContentEditor";

export default ContentEditor;
