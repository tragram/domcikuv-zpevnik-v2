import { useRouteContext } from "@tanstack/react-router";
import { useHistoryState } from "@uidotdev/usehooks";
import { FileInput, Sparkles, ExternalLink } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeWhitespace, replaceRepetitions } from "src/lib/chordpro";
import { UserProfileData } from "src/worker/api/userProfile";
import { Textarea } from "~/components/ui/textarea";
import { cn, tailwindBreakpoint } from "~/lib/utils";
import { autofillChordpro } from "~/services/editor-service";
import {
  convertToChordPro,
  isConvertibleFormat,
} from "../../lib/chords2chordpro";
import "./Editor.css";
import { SmartFeature, SmartFeatureBar } from "./components/SmartFeatureBar";
import {
  SnippetButton,
  SnippetButtonSection,
  snippets,
} from "./components/Snippets";
import { SongData } from "~/types/songData";

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
  songData?: SongData;
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

const hasExternalOriginalContent = (
  songData?: SongData,
  currentContent?: string,
): boolean => {
  if (!songData?.externalSource?.originalContent) return false;
  // Only show if current content is empty or different from original
  return (
    !currentContent ||
    currentContent.trim() === "" ||
    currentContent !== songData.externalSource.originalContent
  );
};

const SMART_FEATURES: SmartFeature[] = [
  {
    id: "show_external_original",
    label: "Show Original Content",
    loadingLabel: "Loading...",
    icon: ExternalLink,
    check: (content: string, user: UserProfileData, songData?: SongData) =>
      hasExternalOriginalContent(songData, content),
    description: (
      <>
        This song was imported from an external source. Click to view the
        original content from the source website.
      </>
    ),
  },
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
  songData,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dismissedFeatures, setDismissedFeatures] = useState<Set<string>>(
    new Set(),
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const api = useRouteContext({ strict: false }).api;

  const contentToFeatureMap = useRef<Map<string, string>>(new Map());

  const {
    state,
    set: setHistoryContent,
    undo,
    redo,
  } = useHistoryState(editorContent);

  const setContent = (value: string) => {
    setHistoryContent(value);
    setEditorContent(value);
  };

  const prevStateRef = useRef(state);

  useEffect(() => {
    // If state changed internally (like via undo) but parent doesn't know yet
    if (state !== prevStateRef.current && state !== editorContent) {
      setEditorContent(state);
    }
    // Always keep track of the latest internal state
    prevStateRef.current = state;
  }, [state, editorContent, setEditorContent]);

  useEffect(() => {
    if (editorContent !== state && editorContent !== prevStateRef.current) {
      setHistoryContent(editorContent);
    }
  }, [editorContent, setHistoryContent, state]); // Only trigger when the parent pushes new content

  const activeFeatures = useMemo(() => {
    return SMART_FEATURES.filter(
      (f) => f.check(state, user, songData) && !dismissedFeatures.has(f.id),
    );
  }, [state, user, songData, dismissedFeatures]);

  // Handle Keyboard Shortcuts for Custom Undo/Redo

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
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
    // Manual edits don't have an associated feature
    setContent(e.target.value);
  };

  const insertSnippet = (snippetKey: keyof typeof snippets) => {
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

  const executeFeature = async (feature: SmartFeature) => {
    const featureId = feature.id;
    const previousContent = state;
    let newContent = state;

    try {
      if (featureId === "show_external_original") {
        newContent = songData!.externalSource!.originalContent!;
      } else if (featureId === "convert_to_chordpro") {
        newContent = normalizeWhitespace(
          replaceRepetitions(convertToChordPro(state)),
        );
      } else if (featureId === "autofill_chords") {
        setIsProcessing(true);
        newContent = await autofillChordpro(state, api);
      }

      if (newContent !== state) {
        contentToFeatureMap.current.set(previousContent, featureId);
        setContent(newContent);
      }
    } catch (error) {
      console.error(`Feature ${featureId} failed:`, error);
    } finally {
      setIsProcessing(false);
    }
  };
  const dismissFeature = (id: string) => {
    setDismissedFeatures((prev) => new Set(prev).add(id));
  };
  return (
    <div className="flex flex-col h-full">
      <div className="w-full flex flex-wrap gap-1 border-b-4 md:border-b-8 border-primary mt-1 md:mt-0">
        <SnippetButtonSection label="Environments">
          <SnippetButton snippetKey="verse_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="bridge_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chorus_env" onInsert={insertSnippet} />
          <SnippetButton snippetKey="tab_env" onInsert={insertSnippet} />
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
          <SnippetButton snippetKey="repetition" onInsert={insertSnippet} />
          <SnippetButton snippetKey="chords" onInsert={insertSnippet} />
        </SnippetButtonSection>
      </div>

      <Textarea
        ref={textareaRef}
        className={cn(
          "resize-none main-container !rounded-t-none outline-none focus-visible:bg-primary/10 h-auto md:h-full flex-grow auto-resize-textarea hyphens-auto border-none",
          activeFeatures.some((f) => f.id === "convert_to_chordpro")
            ? "font-mono !rounded-b-none"
            : "font-normal",
        )}
        onChange={onEditorChange}
        value={state}
        disabled={isProcessing}
      />

      {activeFeatures.map((feature) => (
        <SmartFeatureBar
          key={feature.id}
          feature={feature}
          isProcessing={isProcessing}
          onExecute={() => executeFeature(feature)}
          onDismiss={() => dismissFeature(feature.id)}
        />
      ))}
    </div>
  );
};

export default ContentEditor;
