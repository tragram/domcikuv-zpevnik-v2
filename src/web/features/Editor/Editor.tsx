import ChordSheetJS from "chordsheetjs";
import { ArrowUpDown, ExternalLink, FileInput, Sparkles } from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  normalizeWhitespace,
  parseChordPro,
  replaceRepetitions,
} from "src/lib/chordpro";
import { convertChordNotation } from "src/lib/utils";
import { UserData, useUserData } from "src/web/hooks/use-user-data";

import useLocalStorageState from "use-local-storage-state";
import { convertToChordPro } from "~/lib/chords2chordpro";
import { cn } from "~/lib/utils";
import { autofillChordpro } from "~/services/editor-service";
import { SongData } from "~/types/songData";
import { EditorState } from "~/types/types";
import "../SongView/SongView.css";
import { guessKey } from "../SongView/utils/songRendering";
import CollapsibleMainArea from "./components/CollapsibleMainArea";
import { useEditorValidation } from "./components/use-editor-validation";
import ContentEditor, { ContentEditorRef } from "./ContentEditor";
import "./Editor.css";
import { DEFAULT_EDITOR_SETTINGS, EditorSettings } from "./EditorSettings";
import EditorToolbar from "./EditorToolbar";
import MetadataEditor from "./MetadataEditor";
import Preview from "./Preview";

const editorStatesEqual = (a: EditorState, b: EditorState): boolean => {
  const aKeys = Object.keys(a).sort() as (keyof EditorState)[];
  const bKeys = Object.keys(b).sort() as (keyof EditorState)[];

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key, index) => {
    const objValue1 = a[key];
    const objValue2 = b[bKeys[index]];
    return objValue1 === objValue2;
  });
};

const parseMetadataFromChordPro = (content: string): Partial<EditorState> => {
  const extracted: Partial<EditorState> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*\{(?<key>[a-zA-Z]+):\s*(?<value>.*)\}\s*$/);
    if (match && match.groups) {
      const key = match.groups.key.toLowerCase();
      const value = match.groups.value.trim();

      if (key === "title" || key === "t") extracted.title = value;
      else if (key === "artist") extracted.artist = value;
      else if (key === "capo") extracted.capo = parseInt(value);
      else if (key === "key") extracted.key = value;
      else if (key === "tempo") extracted.tempo = value;
      else if (key === "language") extracted.language = value;
      else if (key === "range") extracted.range = value;
      else if (key === "startmelody") extracted.startMelody = value;
    }
  }
  return extracted;
};

const isAutofillable = (text: string, userData: UserData): boolean => {
  if (!userData || !userData.profile.isTrusted) {
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

const isConvertibleFormat = (text: string): boolean => {
  const lines = text.split("\n");
  let chordLineCount = 0;
  for (const line of lines) {
    if (line.trim() === "") continue;
    if (
      /^([A-H](is|es|s|[#b])?(m|min|maj|dim|aug|sus)?\d*[\s/]*)+$/i.test(
        line.trim(),
      )
    ) {
      chordLineCount++;
    }
  }
  return chordLineCount > 1;
};

export interface SmartFeature {
  id: string;
  label: string;
  loadingLabel: string;
  icon: React.ElementType;
  description: React.ReactNode;
  disabledReason: React.ReactNode;
  actionType?: "default" | "stepper"; // <-- Added actionType
  check: (content: string, user: UserData, songData?: SongData) => boolean;
}

export interface EvaluatedFeature extends SmartFeature {
  isEnabled: boolean;
}

const SMART_FEATURES: SmartFeature[] = [
  {
    id: "show_external_original",
    label: "Show Original Content",
    loadingLabel: "Loading...",
    icon: ExternalLink,
    check: (content: string, user: UserData, songData?: SongData) =>
      hasExternalOriginalContent(songData, content),
    description: (
      <>Click to view the original content from the source website.</>
    ),
    disabledReason: "This song was not imported from a different source.",
  },
  {
    id: "convert_to_chordpro",
    label: "Convert to ChordPro",
    loadingLabel: "Converting...",
    icon: FileInput,
    check: (content: string, user: UserData) => isConvertibleFormat(content),
    description: (
      <>
        When importing songs from other sources, chords are often in separate
        lines above the lyrics. This will format them into the inline ChordPro
        format used by this website.
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
    disabledReason:
      "The content is already in ChordPro format or no convertible chords were detected.",
  },
  {
    id: "autofill_chords",
    label: "Autofill Missing Chords",
    loadingLabel: "Filling...",
    icon: Sparkles,
    check: isAutofillable,
    description: <>Use AI to generate chords in sections where they missing.</>,
    disabledReason:
      "No missing chords detected in lyrics sections, or you are not logged in as a trusted user.",
  },
  {
    id: "transpose",
    label: "Transpose Chords",
    loadingLabel: "Transposing...",
    icon: ArrowUpDown,
    actionType: "stepper",
    check: (content: string) => /\[[A-H][A-Za-z\d#b,\s/]*\]/.test(content),
    description: (
      <>
        Use the <strong>-</strong> and <strong>+</strong> buttons to transpose
        all chords in the editor up or down by semitones.
      </>
    ),
    disabledReason: "No chords detected to transpose.",
  },
];

interface EditorProps {
  songData?: SongData;
  versionId?: string;
}

const Editor: React.FC<EditorProps> = ({ songData, versionId }) => {
  const contentEditorRef = useRef<ContentEditorRef>(null);
  const { userData } = useUserData();
  const editorStateKey = songData
    ? `editor/state/${songData.id}`
    : "editor/state";

  const defaultEditorState: EditorState = (
    songData ? songData : SongData.empty()
  ).toJSON() as EditorState;

  if (versionId) {
    defaultEditorState.parentId = versionId;
  }

  const [editorState, setEditorState] = useLocalStorageState<EditorState>(
    editorStateKey,
    { defaultValue: () => defaultEditorState },
  );

  const [editorSettings, setEditorSettings] =
    useLocalStorageState<EditorSettings>("editor/settings", {
      defaultValue: () => DEFAULT_EDITOR_SETTINGS,
    });

  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAutofill, setPendingAutofill] = useState<{
    originalContent: string;
    newContent: string;
  } | null>(null);

  const evaluatedFeatures: EvaluatedFeature[] = useMemo(() => {
    return SMART_FEATURES.map((f) => ({
      ...f,
      isEnabled: f.check(editorState.chordpro, userData, songData),
    }));
  }, [editorState.chordpro, userData, songData]);

  const initializeEditor = useCallback(() => {
    setEditorState(defaultEditorState);
  }, [setEditorState, defaultEditorState]);

  const backupEditorState = useCallback(
    (editorState: EditorState) => {
      if (!editorStatesEqual(editorState, defaultEditorState as EditorState)) {
        localStorage.setItem(
          editorStateKey + "-backup",
          JSON.stringify(editorState),
        );
      }
    },
    [defaultEditorState, editorStateKey],
  );

  const loadBackupState = useCallback(() => {
    const backup = localStorage.getItem(editorStateKey + "-backup");
    if (backup) {
      setEditorState(JSON.parse(backup));
    }
  }, [editorStateKey, setEditorState]);

  const handleBackupAndInitialize = useCallback(() => {
    backupEditorState(editorState);
    initializeEditor();
  }, [backupEditorState, editorState, initializeEditor]);

  const handleChordproUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (!content) return;

        const parsed = parseChordPro(content);
        backupEditorState(editorState);
        setEditorState((prevState) => ({
          ...prevState,
          title: parsed.title || prevState.title,
          artist: parsed.artist || prevState.artist,
          key: parsed.key || prevState.key,
          capo: parsed.capo ? Number(parsed.capo) : prevState.capo,
          tempo: parsed.tempo || prevState.tempo,
          language: parsed.language || prevState.language,
          chordpro: parsed.chordpro,
        }));
      };
      reader.readAsText(file);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const updateMetadata = (field: keyof EditorState, value: string) => {
    setEditorState({
      ...editorState,
      [field]: value,
    });
  };

  const extractedMetadata = useMemo(
    () => parseMetadataFromChordPro(editorState.chordpro),
    [editorState.chordpro],
  );

  const updateContent = (content: string) => {
    const extracted = parseMetadataFromChordPro(content);
    setEditorState({
      ...editorState,
      ...extracted,
      chordpro: content,
    });
  };

  // Note the added payload parameter
  const executeFeature = async (feature: SmartFeature, payload?: any) => {
    const featureId = feature.id;
    const previousContent = editorState.chordpro;
    let newContent = editorState.chordpro;

    try {
      if (featureId === "show_external_original") {
        newContent = songData!.externalSource!.originalContent!;
        if (newContent !== editorState.chordpro) {
          contentEditorRef.current?.replaceContentWithUndo(newContent);
        }
      } else if (featureId === "convert_to_chordpro") {
        newContent = normalizeWhitespace(
          replaceRepetitions(convertToChordPro(editorState.chordpro)),
        );
        if (newContent !== editorState.chordpro) {
          contentEditorRef.current?.replaceContentWithUndo(newContent);
        }
      } else if (featureId === "autofill_chords") {
        setIsProcessing(true);
        newContent = await autofillChordpro(editorState.chordpro);

        if (newContent !== editorState.chordpro) {
          setPendingAutofill({
            originalContent: previousContent,
            newContent,
          });
        }
      } else if (featureId === "transpose") {
        const steps = payload as number;

        // 1. Try to guess the key from the current content. Fallback to 'C'.
        let songKey = guessKey(editorState.chordpro);
        if (!songKey) {
          songKey = guessKey("[C]");
        }

        if (songKey) {
          let transposedContent = editorState.chordpro;
          const newKey = songKey.transposed(steps);

          // 2. Update {key: ...} directive directly in text
          const czechKey = convertChordNotation(newKey.toString());
          transposedContent = transposedContent.replace(
            /\{key:\s*([^}]+)\}/i,
            `{key: ${czechKey}}`,
          );

          // 3. Transpose all inline chords safely
          transposedContent = transposedContent.replace(
            /\[([^\]]+)\]/g,
            (match, chord) => {
              // Convert Czech to English purely for the parser
              const engChord = chord.replace(/B/g, "Bb").replace(/H/g, "B");

              // Parse the single chord using chordsheetjs
              const parsedChord = ChordSheetJS.Chord.parse(engChord);

              if (parsedChord) {
                // Transpose it
                const transposed = parsedChord.transpose(steps);

                // Format back to Czech notation, respecting bass notes
                const czechOutput = transposed
                  .toString()
                  .split("/")
                  .map((part: string) => convertChordNotation(part))
                  .join("/");

                return `[${czechOutput}]`;
              }

              // Fallback if the parser doesn't understand the string
              return match;
            },
          );

          if (transposedContent !== editorState.chordpro) {
            contentEditorRef.current?.replaceContentWithUndo(transposedContent);
          }
        }
      }
    } catch (error) {
      console.error(`Feature ${featureId} failed:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const { isValid, validationErrors, fieldErrors } =
    useEditorValidation(editorState);

  const hasIllustration = !!songData?.currentIllustration;

  const toolbarTop = true;

  const canBeSubmitted =
    !editorStatesEqual(editorState, defaultEditorState) && isValid;

  return (
    <div className="flex flex-col relative h-fit md:h-dvh gap-4 xl:gap-8 min-w-[250px]">
      {toolbarTop && (
        <EditorToolbar
          editorState={editorState}
          songData={songData}
          toolbarTop={toolbarTop}
          canBeSubmitted={!!canBeSubmitted}
          onBackupAndInitialize={handleBackupAndInitialize}
          validationErrors={validationErrors}
          onLoadBackup={loadBackupState}
          onSubmitSuccess={() => localStorage.removeItem(editorStateKey)}
          userData={userData}
          onUploadClick={onUploadClick}
          editorSettings={editorSettings}
        />
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleChordproUpload}
        className="hidden"
        accept=".pro,.chordpro"
      />
      <div
        className={cn(
          "flex flex-col md:flex-row w-full h-fit md:h-full overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex flex-col md:flex-row h-full w-full gap-4 p-4 xl:gap-8 xl:p-8 overflow-auto",
            toolbarTop ? "!pt-0" : "!pb-0",
          )}
        >
          <CollapsibleMainArea
            title={"Metadata"}
            className={"basis-[20%] 2xl:basis-[15%] md:max-w-[750px]"}
          >
            <MetadataEditor
              defaultMetadata={defaultEditorState}
              metadata={editorState}
              extractedMetadata={extractedMetadata}
              updateMetadata={updateMetadata}
              editorSettings={editorSettings}
              onSettingsChange={setEditorSettings}
              userData={userData}
              fieldErrors={fieldErrors}
              hasIllustration={hasIllustration}
              features={evaluatedFeatures}
              isProcessing={isProcessing}
              onExecuteFeature={executeFeature}
            />
          </CollapsibleMainArea>
          <CollapsibleMainArea title={"Editor"} className={"basis-[40%] "}>
            <ContentEditor
              ref={contentEditorRef}
              editorContent={editorState.chordpro}
              setEditorContent={updateContent}
              pendingAutofill={pendingAutofill}
              isProcessing={isProcessing}
              onAcceptAutofill={(editedContent) => {
                contentEditorRef.current?.replaceContentWithUndo(editedContent);
                setPendingAutofill(null);
              }}
              onRejectAutofill={() => setPendingAutofill(null)}
            />
          </CollapsibleMainArea>
          <CollapsibleMainArea title={"Preview"} className={"basis-[40%]"}>
            <Preview editorState={editorState} />
          </CollapsibleMainArea>
        </div>
      </div>
      {!toolbarTop && (
        <EditorToolbar
          editorState={editorState}
          songData={songData}
          toolbarTop={toolbarTop}
          canBeSubmitted={!!canBeSubmitted}
          validationErrors={validationErrors}
          onBackupAndInitialize={handleBackupAndInitialize}
          onLoadBackup={loadBackupState}
          onSubmitSuccess={() => localStorage.removeItem(editorStateKey)}
          userData={userData}
          onUploadClick={onUploadClick}
          editorSettings={editorSettings}
        />
      )}
    </div>
  );
};

export default Editor;
