import { FileInput, Sparkles, ExternalLink } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { normalizeWhitespace, replaceRepetitions } from "src/lib/chordpro";
import { UserProfileData } from "src/worker/api/userProfile";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
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
import { tailwindBreakpoint } from "~/lib/utils.frontend";
import { EditorAPI } from "src/worker/api-client";
import { AutofillReviewPanel } from "./components/AutofillReviewPanel";

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
  editorAPI: EditorAPI;
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
  editorAPI,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [dismissedFeatures, setDismissedFeatures] = useState<Set<string>>(
    new Set(),
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const [pendingAutofill, setPendingAutofill] = useState<{
    originalContent: string;
    newContent: string;
  } | null>(null);

  const contentToFeatureMap = useRef<Map<string, string>>(new Map());

  const activeFeatures = useMemo(() => {
    return SMART_FEATURES.filter(
      (f) =>
        f.check(editorContent, user, songData) && !dismissedFeatures.has(f.id),
    );
  }, [editorContent, user, songData, dismissedFeatures]);

  const replaceEntireContentWithUndo = (newContent: string) => {
    const textarea = textareaRef.current;

    if (!textarea) {
      setEditorContent(newContent);
      return;
    }

    // 1. Lock the height to prevent the layout from collapsing during replacement
    const currentHeight = textarea.getBoundingClientRect().height;
    const originalHeight = textarea.style.height;
    textarea.style.height = `${currentHeight}px`;

    // 2. Focus and replace
    textarea.focus({ preventScroll: true });
    textarea.select();
    document.execCommand("insertText", false, newContent);
    setEditorContent(newContent);

    // 3. Reset cursor to the top of the file
    textarea.setSelectionRange(0, 0);

    // 4. Unlock the height right before the browser's next visual paint
    requestAnimationFrame(() => {
      textarea.style.height = originalHeight;
    });
  };

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

  const insertSnippet = (snippetKey: keyof typeof snippets) => {
    if (!textareaRef.current || !snippets[snippetKey]) return;
    const snippet = snippets[snippetKey];
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editorContent.substring(start, end);

    const textToInsert = snippet.template(selectedText ?? "");
    const newFullText =
      editorContent.substring(0, start) +
      textToInsert +
      editorContent.substring(end);

    // Focus and highlight selection to prepare for insertion
    textarea.focus();
    textarea.setSelectionRange(start, end);

    // document.execCommand hooks into the browser's native undo stack
    const success = document.execCommand("insertText", false, textToInsert);

    // Keep React state perfectly synced regardless of execCommand support
    setEditorContent(newFullText);

    setTimeout(() => {
      const finalCursorPos = selectedText
        ? start + textToInsert.length
        : start + snippet.cursorOffset;
      textarea.setSelectionRange(finalCursorPos, finalCursorPos);
    }, 0);
  };

  const executeFeature = async (feature: SmartFeature) => {
    const featureId = feature.id;
    const previousContent = editorContent;
    let newContent = editorContent;

    try {
      if (featureId === "show_external_original") {
        newContent = songData!.externalSource!.originalContent!;
        if (newContent !== editorContent) {
          contentToFeatureMap.current.set(previousContent, featureId);
          replaceEntireContentWithUndo(newContent);
        }
      } else if (featureId === "convert_to_chordpro") {
        newContent = normalizeWhitespace(
          replaceRepetitions(convertToChordPro(editorContent)),
        );
        if (newContent !== editorContent) {
          contentToFeatureMap.current.set(previousContent, featureId);
          replaceEntireContentWithUndo(newContent);
        }
      } else if (featureId === "autofill_chords") {
        setIsProcessing(true);
        newContent = await autofillChordpro(editorContent, editorAPI);

        if (newContent !== editorContent) {
          setPendingAutofill({
            originalContent: previousContent,
            newContent,
          });
        }
      }
    } catch (error) {
      console.error(`Feature ${featureId} failed:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptAutofill = (editedContent: string) => {
    if (!pendingAutofill) return;
    contentToFeatureMap.current.set(
      pendingAutofill.originalContent,
      "autofill_chords",
    );
    replaceEntireContentWithUndo(editedContent);
    setPendingAutofill(null);
  };

  const handleRejectAutofill = () => {
    setPendingAutofill(null);
  };

  const dismissFeature = (id: string) => {
    setDismissedFeatures((prev) => new Set(prev).add(id));
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {pendingAutofill && (
        <AutofillReviewPanel
          originalContent={pendingAutofill.originalContent}
          newContent={pendingAutofill.newContent}
          onAccept={handleAcceptAutofill}
          onReject={handleRejectAutofill}
        />
      )}

      {/* ── Main editor column ──────────────────────────────────────── */}
      <div className="flex flex-col h-full min-w-0 w-full">
        <div className="w-full flex flex-wrap gap-1 border-b-4 md:border-b-8 border-primary mt-1 md:mt-0">
          <SnippetButtonSection label="Environments">
            <SnippetButton snippetKey="verse_env" onInsert={insertSnippet} />
            <SnippetButton snippetKey="bridge_env" onInsert={insertSnippet} />
            <SnippetButton snippetKey="chorus_env" onInsert={insertSnippet} />
            <SnippetButton snippetKey="tab_env" onInsert={insertSnippet} />
          </SnippetButtonSection>
          <SnippetButtonSection label="Recalls">
            <SnippetButton snippetKey="verse_recall" onInsert={insertSnippet} />
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

        <Textarea
          ref={textareaRef}
          className={cn(
            "resize-none main-container !rounded-t-none outline-none focus-visible:bg-primary/10 h-auto md:h-full flex-grow auto-resize-textarea hyphens-auto border-none",
            activeFeatures.some((f) => f.id === "convert_to_chordpro")
              ? "font-mono !rounded-b-none"
              : "font-normal",
          )}
          onChange={onEditorChange}
          value={editorContent}
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
    </div>
  );
};

export default ContentEditor;
