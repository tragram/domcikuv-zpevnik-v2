import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import React, { useEffect, useRef, useState, useMemo } from "react";
import "./Editor.css";
import {
  SnippetButtonSection,
  SnippetButton,
  snippets,
} from "./components/Snippets";
import { cn, tailwindBreakpoint } from "~/lib/utils";
import { convertToChordPro, isConvertibleFormat } from "./chords2chordpro";
import { X, Sparkles, FileInput } from "lucide-react"; // Assuming Lucide icons are available

const textareaAutoSizeStyles = `
@media (max-width: 810px) {
  .auto-resize-textarea {
    overflow-y: hidden;
  }
}
`;

interface ContentEditorProps {
  editorContent: string;
  setEditorContent: (content: string) => void;
}

// --- Smart Feature Definitions ---

interface SmartFeature {
  id: string;
  label: string;
  loadingLabel: string;
  icon: React.ElementType;
  description: React.ReactNode;
  check: (content: string) => boolean;
}

/**
 * Checks for sections that have lyrics but NO chords, while ensuring
 * at least one OTHER section in the song DOES have chords (context).
 */
const isAutofillable = (text: string): boolean => {
  // 1. Basic check: Does the song have *any* chords?
  // If no chords exist at all, we might want "Compose" logic, but for "Autofill" we need a seed.
  const hasAnyChords = /\[[A-G][^\]]*\]/.test(text);
  if (!hasAnyChords) return false;

  // 2. Split into sections based on ChordPro directives
  // Matches {sov}, {start_of_verse}, {c}, etc.
  const sectionSplitRegex =
    /(\{(?:sov|start_of_verse|soc|start_of_chorus|sob|start_of_bridge|v|c|b|verse|chorus|bridge)(?::.*)?\})/i;
  const parts = text.split(sectionSplitRegex);

  // 3. Scan sections. We look for a part that follows a directive, has content, but NO chords.
  for (let i = 1; i < parts.length; i += 2) {
    // parts[i] is the directive, parts[i+1] is the content
    const content = parts[i + 1];
    if (!content) continue;

    const hasLyrics = content.trim().length > 0;
    const hasChordsInSection = /\[[A-G][^\]]*\]/.test(content);

    // If we find a section with lyrics but no chords, this is a candidate for autofill
    if (hasLyrics && !hasChordsInSection) {
      return true;
    }
  }

  return false;
};

const SMART_FEATURES: SmartFeature[] = [
  {
    id: "convert_to_chordpro",
    label: "Convert to ChordPro",
    loadingLabel: "Converting...",
    icon: FileInput,
    check: isConvertibleFormat,
    description: (
      <>
        Detected chords in separate lines above the lyrics. This will format
        them into the ChordPro inline format used by this website. The song is
        now shown in a monospace font to help with proper alignment.
        <br />
        <br />
        <strong>For best results:</strong>
        <ul className="list-disc pl-4">
          <li>Place chords precisely above the syllable where they belong.</li>
          <li>Indicate separate sections by blank lines.</li>
          <li>Use Ctrl+Z to go back and adjust if necessary.</li>
        </ul>
      </>
    ),
  },
  {
    id: "autofill_chords",
    label: "Autofill Missing Chords",
    loadingLabel: "Analyzing & Filling...",
    icon: Sparkles,
    check: isAutofillable,
    description: (
      <>
        Some sections have chords, but others are empty. The AI can fill in the
        missing chords based on the song's context.
        <ul className="list-disc pl-4 mt-2">
          <li>Analyzes your existing Verses/Choruses.</li>
          <li>Propagates patterns to empty sections.</li>
        </ul>
      </>
    ),
  },
];

const ContentEditor: React.FC<ContentEditorProps> = ({
  editorContent,
  setEditorContent,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Feature State
  const [dismissedFeatures, setDismissedFeatures] = useState<Set<string>>(
    new Set()
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Determine active feature
  const activeFeature = useMemo(() => {
    return SMART_FEATURES.find(
      (feature) =>
        feature.check(editorContent) && !dismissedFeatures.has(feature.id)
    );
  }, [editorContent, dismissedFeatures]);

  useEffect(() => {
    if (textareaRef.current && window.innerWidth < tailwindBreakpoint("md")) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editorContent]);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = textareaAutoSizeStyles;
    document.head.appendChild(style);

    const adjustTextareaHeight = () => {
      if (!textareaRef.current) return;
      const textarea = textareaRef.current;
      if (window.innerWidth < tailwindBreakpoint("md")) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      } else {
        textarea.style.height = "";
      }
    };

    window.addEventListener("resize", adjustTextareaHeight);
    adjustTextareaHeight();

    return () => {
      document.head.removeChild(style);
      window.removeEventListener("resize", adjustTextareaHeight);
    };
  }, []);

  const onEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
  };

  const replaceEditorContent = (newText: string) => {
    if (!textareaRef.current) {
      setEditorContent(newText);
      return;
    }
    const textarea = textareaRef.current;
    textarea.focus();
    try {
      textarea.select();
      const success = document.execCommand("insertText", false, newText);
      if (!success) throw new Error("execCommand failed");
      setEditorContent(newText);
      textarea.setSelectionRange(0, 0);
    } catch (e) {
      console.error("Error using execCommand:", e);
      setEditorContent(newText);
    }
  };

  const insertSnippet = (snippetKey: string) => {
    if (!textareaRef.current || !snippets[snippetKey]) return;
    const snippet = snippets[snippetKey];
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editorContent.substring(start, end);

    textarea.focus();
    const textToInsert = snippet.template(selectedText ?? "");
    const finalCursorPos = selectedText
      ? start + textToInsert.length
      : start + snippet.cursorOffset;

    try {
      if (typeof InputEvent === "function") {
        if (start !== end) document.execCommand("delete", false);
        document.execCommand("insertText", false, textToInsert);
        textarea.setSelectionRange(finalCursorPos, finalCursorPos);
      } else {
        throw new Error("Legacy fallback");
      }
    } catch (e) {
      const newContent =
        editorContent.substring(0, start) +
        textToInsert +
        editorContent.substring(end);
      setEditorContent(newContent);
      setTimeout(
        () => textarea.setSelectionRange(finalCursorPos, finalCursorPos),
        0
      );
    }
  };

  // --- Feature Handlers ---

  const handleDismiss = () => {
    if (activeFeature) {
      setDismissedFeatures((prev) => new Set(prev).add(activeFeature.id));
    }
  };

  const executeFeature = async () => {
    if (!activeFeature) return;

    if (activeFeature.id === "convert_to_chordpro") {
      const converted = convertToChordPro(editorContent);
      replaceEditorContent(converted);
      // Automatically dismiss convert after usage
      setDismissedFeatures((prev) => new Set(prev).add("convert_to_chordpro"));
    } else if (activeFeature.id === "autofill_chords") {
      setIsProcessing(true);
      try {
        const response = await fetch("/api/editor/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chordpro: editorContent }),
        });

        if (!response.ok) throw new Error(`Error: ${response.statusText}`);

        const data = await response.json();
        if (data.status === "success" && data.data?.chordpro) {
          replaceEditorContent(data.data.chordpro);
          // Dismiss autofill after usage
          setDismissedFeatures((prev) => new Set(prev).add("autofill_chords"));
        }
      } catch (error) {
        console.error("Autofill failed", error);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="w-full flex flex-wrap gap-1 border-b-4 md:border-b-8 border-primary mt-1 md:mt-0">
        <SnippetButtonSection label="Environments">
          <SnippetButton snippetKey="verse_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="bridge_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_env" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Recalls">
          <SnippetButton snippetKey="verse_recall" onInsert={insertSnippet} />
          <SnippetButton snippetKey="bridge_recall" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_recall" onInsert={insertSnippet} />
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
          <SnippetButton snippetKey="append_content" onInsert={insertSnippet} />
        </SnippetButtonSection>
        <SnippetButtonSection label="Misc">
          <SnippetButton snippetKey="comment" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chords" onInsert={insertSnippet} />
        </SnippetButtonSection>
      </div>

      <Textarea
        ref={textareaRef}
        className={cn(
          "resize-none main-container !rounded-t-none outline-none focus-visible:bg-primary/10 h-auto md:h-full flex-grow auto-resize-textarea hyphens-auto border-none",
          activeFeature?.id === "convert_to_chordpro"
            ? "font-mono !rounded-b-none"
            : "font-normal"
        )}
        onInput={onEditorChange}
        value={editorContent}
        disabled={isProcessing}
      />

      {/* Dynamic Smart Feature Bar */}
      {activeFeature && (
        <div className="relative group animate-in slide-in-from-bottom-2 duration-300">
          <div className="w-full overflow-hidden bg-muted border-t-2 border-primary px-4 text-xs hidden group-hover:visible group-hover:flex flex-col py-2 pr-8">
            <div className="font-bold mb-1 flex items-center gap-2">
              <activeFeature.icon className="w-3 h-3" />
              {activeFeature.label} detected
            </div>
            <div className="opacity-90">{activeFeature.description}</div>

            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded transition-colors"
              title="Dismiss suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Button
            onClick={executeFeature}
            disabled={isProcessing}
            className="w-full rounded-none h-10 transition-transform font-semibold !bg-muted border-t-2 border-primary group-hover:border-t-0 flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin">⏳</span>{" "}
                {activeFeature.loadingLabel}
              </>
            ) : (
              <>
                <activeFeature.icon className="w-2 h-2" />
                {activeFeature.label}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ContentEditor;
