import React, { useCallback, useRef } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import useLocalStorageState from "use-local-storage-state";
import { parseChordPro } from "../../../lib/chordpro";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { SongDB } from "~/types/types";
import { type EditorSubmitSchemaInput } from "../../../worker/api/editor";
import "../SongView/SongView.css";
import CollapsibleMainArea from "./components/CollapsibleMainArea";
import ContentEditor from "./ContentEditor";
import "./Editor.css";
import EditorToolbar from "./EditorToolbar";
import MetadataEditor from "./MetadataEditor";
import Preview from "./Preview";
import { DEFAULT_EDITOR_SETTINGS, EditorSettings } from "./EditorSettings";

export type EditorState = EditorSubmitSchemaInput;

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

interface EditorProps {
  songDB: SongDB;
  songData?: SongData;
  user: UserProfileData;
  versionId?: string;
}

const Editor: React.FC<EditorProps> = ({
  songDB,
  songData,
  user,
  versionId,
}) => {
  const editorStateKey = songData
    ? `editor/state/${songData.id}`
    : "editor/state";

  const defaultEditorState: EditorState = (
    songData ? songData : SongData.empty()
  ).toJSON() as EditorState;

  // If we are editing a specific version (e.g. a pending draft or an old version),
  // we set that as the parentId.
  // - If it's a pending draft, the backend will update it in place.
  // - If it's a published version, the backend will fork it.
  if (versionId) {
    defaultEditorState.parentId = versionId;
  }

  const [editorState, setEditorState] = useLocalStorageState<EditorState>(
    editorStateKey,
    { defaultValue: () => defaultEditorState },
  );

  // Editor settings stored per-user
  const [editorSettings, setEditorSettings] =
    useLocalStorageState<EditorSettings>("editor/settings", {
      defaultValue: () => DEFAULT_EDITOR_SETTINGS,
    });

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

  const updateContent = (content: string) => {
    setEditorState({
      ...editorState,
      chordpro: content,
    });
  };

  const toolbarTop = true;

  const canBeSubmitted =
    !editorStatesEqual(editorState, defaultEditorState) &&
    editorState.artist &&
    editorState.title &&
    editorState.chordpro;

  return (
    <div className="flex flex-col relative h-fit md:h-dvh gap-4 xl:gap-8 min-w-[250px]">
      {toolbarTop && (
        <EditorToolbar
          editorState={editorState}
          songData={songData}
          toolbarTop={toolbarTop}
          canBeSubmitted={!!canBeSubmitted}
          onBackupAndInitialize={handleBackupAndInitialize}
          onLoadBackup={loadBackupState}
          onSubmitSuccess={() => localStorage.removeItem(editorStateKey)}
          user={user}
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
              songDB={songDB}
              defaultMetadata={defaultEditorState}
              metadata={editorState}
              updateMetadata={updateMetadata}
              editorSettings={editorSettings}
              onSettingsChange={setEditorSettings}
              user={user}
            />
          </CollapsibleMainArea>
          <CollapsibleMainArea title={"Editor"} className={"basis-[40%] "}>
            <ContentEditor
              editorContent={editorState.chordpro}
              setEditorContent={updateContent}
              user={user}
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
          onBackupAndInitialize={handleBackupAndInitialize}
          onLoadBackup={loadBackupState}
          onSubmitSuccess={() => localStorage.removeItem(editorStateKey)}
          user={user}
          onUploadClick={onUploadClick}
          editorSettings={editorSettings}
        />
      )}
    </div>
  );
};

export default Editor;
