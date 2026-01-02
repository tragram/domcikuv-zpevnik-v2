import { useRouteContext } from "@tanstack/react-router";
import { FileInput, Hourglass, Sparkles, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistoryState } from "@uidotdev/usehooks";
import { UserProfileData } from "src/worker/api/userProfile";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn, tailwindBreakpoint } from "~/lib/utils";
import { autofillChordpro } from "~/services/editorHelpers";
import "./Editor.css";
import { convertToChordPro, isConvertibleFormat } from "./chords2chordpro";
import {
  SnippetButton,
  SnippetButtonSection,
  snippets,
} from "./components/Snippets";
import { SmartFeature, SmartFeatureBar } from "./components/SmartFeatureBar";
import { normalizeWhitespace, replaceRepetitions } from "src/lib/chordpro";

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
  user: UserProfileData;
}

const isAutofillable = (text: string, user: UserProfileData): boolean => {
  if (!user.loggedIn || !user.profile.isTrusted) {
    return false;
  }
  const hasAnyChords = /\[[A-G][^\]]*\]/.test(text);
  if (!hasAnyChords) return false;

  const sectionSplitRegex =
    /(\{(?:sov|start_of_verse|soc|start_of_chorus|sob|start_of_bridge|v|c|b|verse|chorus|bridge)(?::.*)?\})/i;
  const parts = text.split(sectionSplitRegex);

  for (let i = 1; i < parts.length; i += 2) {
    const content = parts[i + 1];
    if (!content) continue;

    const hasLyrics = content.trim().length > 0;
    const hasChordsInSection = /\[[A-G][^\]]*\]/.test(content);

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
    check: (content: string, user: UserProfileData) =>
      isConvertibleFormat(content),
    description: (
      <>
        Detected chords in separate lines above the lyrics. This will format
        them into the ChordPro inline format used by this website.
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
        Detected some sections having chords but not all of them. Use AI to
        generate missing chords.
      </>
    ),
  },
];

const ContentEditor: React.FC<ContentEditorProps> = ({
  editorContent,
  setEditorContent,
  user,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dismissedFeatures, setDismissedFeatures] = useState<Set<string>>(
    new Set()
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const api = useRouteContext({ strict: false }).api;

  // Manual History Management - Fixed destructuring
  const {
    state,
    set: setHistoryContent,
    undo,
    redo,
  } = useHistoryState(editorContent);

  // Wrap setContent to update both history and parent
  const setContent = (value: string) => {
    setHistoryContent(value);
    setEditorContent(value);
  };

  // Sync parent when undo/redo changes the state
  const prevStateRef = useRef(state);
  useEffect(() => {
    if (state !== prevStateRef.current && state !== editorContent) {
      setEditorContent(state);
      prevStateRef.current = state;
    }
  }, [state, editorContent, setEditorContent]);

  const activeFeature = useMemo(() => {
    return SMART_FEATURES.find(
      (f) => f.check(state, user) && !dismissedFeatures.has(f.id)
    );
  }, [state, user, dismissedFeatures]);

  // Handle Keyboard Shortcuts for Custom Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

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
    setContent(e.target.value);
  };

  const insertSnippet = (snippetKey: string) => {
    if (!textareaRef.current || !snippets[snippetKey]) return;
    const snippet = snippets[snippetKey];
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = state.substring(start, end);

    const textToInsert = snippet.template(selectedText ?? "");
    const newFullText =
      state.substring(0, start) + textToInsert + state.substring(end);

    setContent(newFullText);

    // Set cursor position after React update
    setTimeout(() => {
      const finalCursorPos = selectedText
        ? start + textToInsert.length
        : start + snippet.cursorOffset;
      textarea.setSelectionRange(finalCursorPos, finalCursorPos);
      textarea.focus();
    }, 0);
  };

  const executeFeature = async () => {
    if (!activeFeature) return;

    if (activeFeature.id === "convert_to_chordpro") {
      const converted = normalizeWhitespace(
        replaceRepetitions(convertToChordPro(state))
      );
      setContent(converted); // This pushes to custom history stack
      setDismissedFeatures((prev) => new Set(prev).add("convert_to_chordpro"));
    } else if (activeFeature.id === "autofill_chords") {
      setIsProcessing(true);
      try {
        const newChordpro = await autofillChordpro(state, api);
        setContent(newChordpro); // This pushes to custom history stack
        setDismissedFeatures((prev) => new Set(prev).add("autofill_chords"));
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
        onChange={onEditorChange}
        value={state}
        disabled={isProcessing}
      />

      {activeFeature && (
        <SmartFeatureBar
          feature={activeFeature}
          isProcessing={isProcessing}
          onExecute={executeFeature}
          onDismiss={() =>
            setDismissedFeatures((prev) => new Set(prev).add(activeFeature.id))
          }
        />
      )}
    </div>
  );
};

export default ContentEditor;
