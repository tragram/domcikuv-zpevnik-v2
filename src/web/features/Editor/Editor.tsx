import { Button } from "~/components/ui/button";
import {
  emptySongMetadata,
  SongData,
  type SongMetadata,
  songMetadataEqual,
} from "~/types/songData";
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
import { Home, RefreshCcw, Trash, Undo, User } from "lucide-react";
import PullRequestButton from "./components/PullRequestButton";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";

export interface EditorState {
  content: string;
  metadata: SongMetadata;
}

const editorStatesEqual = (a: EditorState, b: EditorState) => {
  if (a.content !== b.content) {
    return false;
  }
  return songMetadataEqual(a.metadata, b.metadata);
};

const songData2State = (songData: SongData) => {
  return {
    content: songData.content,
    metadata: songData.extractMetadata(),
  } as EditorState;
};

interface EditorProps {
  songDB: any;
  songData?: SongData;
}

const Editor: React.FC<EditorProps> = ({ songDB, songData: songDataURL }) => {
  const editorStateKey = songDataURL
    ? `editor/state/${songDataURL.id}`
    : "editor/state";
  const defaultEditorState = useMemo(() => {
    if (songDataURL) {
      return songData2State(songDataURL);
    } else {
      const metadata = emptySongMetadata();
      const currentDate = new Date();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0"); // Months are 0-based
      const year = currentDate.getFullYear();
      metadata.dateAdded = `${month}-${year}`;
      return {
        content: "",
        metadata: metadata,
      } as EditorState;
    }
  }, [songDataURL]);

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
  const updateMetadata = (
    field: keyof EditorState["metadata"],
    value: string
  ) => {
    setEditorState({
      ...editorState,
      metadata: {
        ...editorState.metadata,
        [field]: value,
      },
    });
  };

  // Helper function to update the content
  const updateContent = (content: string) => {
    setEditorState({
      ...editorState,
      content,
    });
  };

  const toolbarTop = true;

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
          {songDataURL ? (
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
          Undo {songDataURL ? "reload" : "clear"}
          <Undo />
        </Button>
        <Button asChild>
          <Link to="/">
            <Home />
            Home
          </Link>
        </Button>
        <SettingsDropdown />
        <DownloadButton
          metadata={editorState.metadata}
          content={editorState.content}
        />
        <PullRequestButton
          metadata={editorState.metadata}
          content={editorState.content}
        />
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
              metadata={editorState.metadata}
              updateMetadata={updateMetadata}
            />
          </CollapsibleMainArea>
          <CollapsibleMainArea
            title={"Editor"}
            className={"basis-[40%] "}
            isEditor={true}
          >
            <ContentEditor
              editorContent={editorState.content}
              setEditorContent={updateContent}
            />
          </CollapsibleMainArea>
          <CollapsibleMainArea title={"Preview"} className={"basis-[40%]"}>
            <Preview
              metadata={editorState.metadata}
              content={editorState.content}
            />
          </CollapsibleMainArea>
        </div>
      </div>
      {!toolbarTop && <Toolbar />}
    </div>
  );
};

export default Editor;
