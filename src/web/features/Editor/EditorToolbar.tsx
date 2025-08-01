import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { toast } from "sonner";
import { CloudUpload, Home, RefreshCcw, Trash, Undo, User } from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { SongData } from "~/types/songData";
import { makeApiRequest } from "~/services/apiHelpers";
import { useQueryClient } from "@tanstack/react-query";
import { cn, useLoggedIn } from "~/lib/utils";
import SettingsDropdown from "./components/SettingsDropdown";
import DownloadButton from "./components/DownloadButton";
import { EditorState } from "./Editor";

interface EditorToolbarProps {
  editorState: EditorState;
  songData?: SongData;
  toolbarTop: boolean;
  canBeSubmitted: boolean;
  onBackupAndInitialize: () => void;
  onLoadBackup: () => void;
  onInitializeEditor: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorState,
  songData,
  toolbarTop,
  canBeSubmitted,
  onBackupAndInitialize,
  onLoadBackup,
  onInitializeEditor,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = useLoggedIn();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editorApi = useRouteContext({ from: "/edit" }).api.editor;
  const queryClient = useQueryClient();

  const handleLoginRedirect = () => {
    navigate({
      to: "/login",
      search: {
        redirect: location.pathname,
      },
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await makeApiRequest(() =>
        songData
          ? editorApi[":id"].$put({
              param: { id: songData.id },
              json: editorState,
            })
          : editorApi.$post({ json: editorState })
      );
      const version = response.version;
      const isUpdate =
        new Date(version.createdAt).getTime() !==
        new Date(version.updatedAt).getTime();
      toast.success(
        `Successfully ${
          isUpdate ? "updated" : "submitted"
        } your version of the song!`
      );
      onInitializeEditor();
      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["my-edits"] });
      navigate({ to: "/submissions" });
    } catch (e) {
      toast.error("Something went wrong during submission", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap w-auto mx-4 xl:mx-8 border-4 border-primary rounded-md max-md:justify-around md:justify-between [&>*]:bg-transparent [&>*]:rounded-none",
        toolbarTop ? "mt-4 xl:mt-8" : "mb-4 xl:mb-8 "
      )}
    >
      {/* links */}
      <div className="flex editor-toolbar-links">
        <Button asChild>
          <Link to="/">
            <Home />
            Home
          </Link>
        </Button>
        {!loggedIn ? (
          <Button onClick={handleLoginRedirect}>
            <User />
            Login
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link to="/submissions">
                <User />
                My edits
              </Link>
            </Button>
          </>
        )}
      </div>
      {/* editor actions */}
      <div className="flex editor-toolbar-actions">
        <Button onClick={onBackupAndInitialize}>
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
        <Button onClick={onLoadBackup}>
          Undo {songData ? "reload" : "clear"}
          <Undo />
        </Button>
        <SettingsDropdown />
      </div>
      {/* "final" actions */}
      <div className="flex justify-center max-lg:flex-wrap max-lg:w-full editor-toolbar-submit">
        <DownloadButton editorState={editorState} />
        <Button
          onClick={handleSubmit}
          disabled={!canBeSubmitted || isSubmitting}
        >
          {isSubmitting
            ? "Submitting..."
            : `Submit ${songData ? "edit" : "new song"}`}
          <CloudUpload />
        </Button>
      </div>
    </div>
  );
};

export default EditorToolbar;
