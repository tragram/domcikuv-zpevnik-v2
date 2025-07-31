import { Button } from "~/components/ui/button";
import React, { useCallback, useMemo } from "react";
import useLocalStorageState from "use-local-storage-state";
import "../SongView/SongView.css";
import CollapsibleMainArea from "./components/CollapsibleMainArea";
import ContentEditor from "./ContentEditor";
import "./Editor.css";
import MetadataEditor from "./MetadataEditor";
import Preview from "./Preview";
import { cn, useLoggedIn } from "~/lib/utils";
import SettingsDropdown from "./components/SettingsDropdown";
import DownloadButton from "./components/DownloadButton";
import { CloudUpload, Home, RefreshCcw, Trash, Undo, User } from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { SongDB } from "~/types/types";
import { UserProfileData } from "src/worker/api/userProfile";
import { SongData } from "~/types/songData";
import { SongDataApi } from "src/worker/api/songDB";

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
export type EditorState = Omit<
  SongDataApi,
  | "createdAt"
  | "updatedAt"
  | "currentIllustration"
  | "isFavoriteByCurrentUser"
  | "updateStatus"
>;

interface EditorProps {
  songDB: SongDB;
  songData?: SongData;
  user: UserProfileData;
}

const Editor: React.FC<EditorProps> = ({ songDB, songData, user }) => {
  const editorStateKey = songData
    ? `editor/state/${songData.id}`
    : "editor/state";
  const defaultEditorState: EditorState = (
    songData ? songData : SongData.empty()
  ).toJSON();
  const editorApi = useRouteContext({ from: "/edit/$songId" }).api.editor;

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

  //TODO: this is broken
  const canBeSubmitted =
    !editorStatesEqual(editorState, defaultEditorState) &&
    editorState.artist &&
    editorState.title &&
    editorState.chordpro;
  const Toolbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const handleLoginRedirect = () => {
      navigate({
        to: "/login",
        search: {
          redirect: location.pathname,
        },
      });
    };
    const loggedIn = useLoggedIn();
    return (
      <div
        className={cn(
          "flex flex-wrap w-auto mx-4 xl:mx-8 border-4 border-primary rounded-md max-md:justify-around [&>*]:bg-transparent [&>*]:rounded-none",
          toolbarTop ? "mt-4 xl:mt-8" : "mb-4 xl:mb-8 "
        )}
      >
        <Button
          onClick={() => {
            backupEditorState(editorState);
            initializeEditor();
          }}
        >
          {songData ? (
            <>
              Reload song <RefreshCcw />
            </>
          ) : (
            <>
              Clear <Trash />
            </>
          )}
        </Button>
        <Button
          onClick={() => {
            loadBackupState();
          }}
        >
          Undo {songData ? "reload" : "clear"}
          <Undo />
        </Button>
        <Button asChild>
          <Link to="/">
            <Home />
            Home
          </Link>
        </Button>
        <SettingsDropdown />
        <DownloadButton editorState={editorState} />
        {/* <PullRequestButton
          metadata={editorState.metadata}
          content={editorState.content}
          disabled={!canBeSubmitted}
        /> */}
        {loggedIn && (
          <Button
            onClick={
              songData
                ? () =>
                    editorApi[":id"].$put({
                      param: { id: songData.id },
                      json: editorState,
                    })
                : () => editorApi.$post({ json: editorState })
            }
            disabled={!canBeSubmitted}
          >
            <CloudUpload />
            Submit {songData ? "edit" : "new song"}
          </Button>
        )}
        {!loggedIn && (
          <Button onClick={handleLoginRedirect}>
            <User />
            Login
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col relative h-fit md:h-dvh gap-4 xl:gap-8 min-w-[250px]">
      {toolbarTop && <Toolbar />}
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
      {!toolbarTop && <Toolbar />}
    </div>
  );
};

export default Editor;
