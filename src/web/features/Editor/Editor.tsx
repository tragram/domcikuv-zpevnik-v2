import React, { useCallback } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import useLocalStorageState from "use-local-storage-state";
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
}

const Editor: React.FC<EditorProps> = ({ songDB, songData }) => {
  const editorStateKey = songData
    ? `editor/state/${songData.id}`
    : "editor/state";
  const defaultEditorState: EditorState = (
    songData ? songData : SongData.empty()
  ).toJSON();

  const [editorState, setEditorState] = useLocalStorageState<EditorState>(
    editorStateKey,
    { defaultValue: () => defaultEditorState }
  );

  const initializeEditor = useCallback(() => {
    setEditorState(defaultEditorState);
  }, [setEditorState, defaultEditorState]);

  const backupEditorState = useCallback(
    (editorState: EditorState) => {
      if (!editorStatesEqual(editorState, defaultEditorState as EditorState)) {
        localStorage.setItem(
          editorStateKey + "-backup",
          JSON.stringify(editorState)
        );
      }
    },
    [defaultEditorState, editorStateKey]
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

  // Helper function to update individual metadata fields
  const updateMetadata = (field: keyof EditorState, value: string) => {
    setEditorState({
      ...editorState,
      [field]: value,
    });
  };

  // Helper function to update the content
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
          onInitializeEditor={initializeEditor}
        />
      )}
      <div
        className={cn(
          "flex flex-col md:flex-row w-full h-fit md:h-full overflow-hidden"
        )}
      >
        <div
          className={cn(
            "flex flex-col md:flex-row h-full w-full gap-4 p-4 xl:gap-8 xl:p-8 overflow-auto",
            toolbarTop ? "!pt-0" : "!pb-0"
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
            />
          </CollapsibleMainArea>
          <CollapsibleMainArea title={"Editor"} className={"basis-[40%] "}>
            <ContentEditor
              editorContent={editorState.chordpro}
              setEditorContent={updateContent}
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
          onInitializeEditor={initializeEditor}
        />
      )}
    </div>
  );
};

export default Editor;
