import { Button } from "~/components/ui/button";
import React, { useState } from "react";
import { toast } from "sonner";
import {
  CloudUpload,
  Home,
  RefreshCcw,
  Trash,
  Undo,
  Upload,
  User,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { SongData } from "~/types/songData";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "~/lib/utils";
import SettingsDropdown from "./components/SettingsDropdown";
import DownloadButton from "./components/DownloadButton";
import { UserProfileData } from "src/worker/api/userProfile";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { EditorSettings } from "./EditorSettings";
import { normalizeWhitespace, replaceRepetitions } from "src/lib/chordpro";
import EditorHelp from "./components/EditorHelp";
import {
  generateSongIllustration,
  submitSongVersion,
} from "~/services/editor-service";
import { EditorState } from "~/types/types";
import { useLoggedIn } from "~/lib/utils.frontend";

interface EditorToolbarProps {
  editorState: EditorState;
  songData?: SongData;
  toolbarTop: boolean;
  canBeSubmitted: boolean;
  onBackupAndInitialize: () => void;
  onLoadBackup: () => void;
  onSubmitSuccess?: () => void;
  onUploadClick: () => void;
  user: UserProfileData;
  editorSettings: EditorSettings;
}

// Helper to strip exactly the metadata directives we auto-parsed
const stripMetadataDirectives = (content: string): string => {
  const keysToStrip = [
    "title",
    "t",
    "artist",
    "capo",
    "key",
    "tempo",
    "language",
    "range",
    "startmelody",
  ];

  return content
    .split("\n")
    .filter((line) => {
      const match = line.match(/^\s*\{(?<key>[a-zA-Z]+):\s*(?<value>.*)\}\s*$/);
      if (match && match.groups) {
        return !keysToStrip.includes(match.groups.key.toLowerCase());
      }
      return true;
    })
    .join("\n");
};

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorState,
  songData,
  toolbarTop,
  canBeSubmitted,
  onBackupAndInitialize,
  onLoadBackup,
  onSubmitSuccess,
  onUploadClick,
  user,
  editorSettings,
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

  const generateIllustrationInBackground = (
    songId: string,
    settings: EditorSettings,
  ) => {
    generateSongIllustration(
      songId,
      settings.defaultImageModel,
      settings.defaultPromptVersion,
      settings.defaultSummaryModel,
    )
      .then((response) => {
        if (response.ok) {
          console.log(`Illustration generation started for song ${songId}`);
          toast.info("Illustration generation started in background");
        } else {
          console.error("Failed to start illustration generation");
        }
      })
      .catch((error) => {
        console.error("Failed to generate illustration:", error);
      });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // 1. Strip the directives cleanly (this also strips their newlines)
    const strippedChordpro = stripMetadataDirectives(editorState.chordpro);

    // 2. Inject the cleaned string into the parsed state
    const parsedState = {
      ...editorState,
      chordpro: normalizeWhitespace(replaceRepetitions(strippedChordpro)),
      parentId: editorState?.parentId,
    };

    try {
      // Use the new service function
      const response = await submitSongVersion(
        editorApi,
        parsedState,
        songData?.id,
      );

      const version = response.version;
      const isUpdate =
        new Date(version.createdAt).getTime() !==
        new Date(version.updatedAt).getTime();

      toast.success(
        `Successfully ${
          isUpdate ? "updated" : "submitted"
        } your version of the song!`,
      );

      onSubmitSuccess?.();

      // Auto-generate illustration if enabled, new song being submitted and user is trusted
      if (
        !isUpdate &&
        user.loggedIn &&
        user.profile.isTrusted &&
        editorSettings.autoGenerateIllustration
      ) {
        generateIllustrationInBackground(response.song.id, editorSettings);
      }

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });

      if (user.profile && user.profile.isAdmin) {
        navigate({ to: "/admin", search: { tab: "songs" } });
      } else {
        navigate({ to: "/submissions" });
      }
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
        toolbarTop ? "mt-4 xl:mt-8" : "mb-4 xl:mb-8 ",
      )}
    >
      {/* links */}
      <div className="flex editor-toolbar-links">
        <Button className="hover:text-white bg-transparent" asChild>
          <Link to="/">
            <Home />
            Home
          </Link>
        </Button>
        {!loggedIn ? (
          <Button
            className="hover:text-white bg-transparent"
            onClick={handleLoginRedirect}
          >
            <User />
            Login
          </Button>
        ) : (
          <>
            <Button className="hover:text-white bg-transparent" asChild>
              <Link to="/submissions">
                <User />
                My edits
              </Link>
            </Button>
          </>
        )}
      </div>
      {/* editor actions */}
      <div className="flex editor-toolbar-actions flex-wrap justify-center">
        <EditorHelp />
        <Button
          className="hover:text-white bg-transparent"
          onClick={onUploadClick}
        >
          Upload ChordPro
          <Upload />
        </Button>
        <Button
          className="hover:text-white bg-transparent"
          onClick={onBackupAndInitialize}
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
          className="hover:text-white bg-transparent"
          onClick={onLoadBackup}
        >
          Undo {songData ? "reload" : "clear"}
          <Undo />
        </Button>
        <SettingsDropdown />
      </div>
      {/* "final" actions */}
      <div className="flex justify-center md:justify-end max-lg:flex-wrap max-xl:w-full editor-toolbar-submit">
        <DownloadButton editorState={editorState} />

        {user.loggedIn ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button
                  className="bg-transparent"
                  onClick={handleSubmit}
                  disabled={!canBeSubmitted || isSubmitting}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : `Submit ${songData ? "edit" : "new song"}`}
                  <CloudUpload />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              You can only submit a song once all the required metadata has been
              entered.
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button className="bg-transparent" disabled>
                  Log in to submit
                  <CloudUpload />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Don't worry, the song data has been saved!
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

export default EditorToolbar;
