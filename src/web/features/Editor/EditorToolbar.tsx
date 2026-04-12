import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import {
  CloudUpload,
  Home,
  RefreshCcw,
  Trash,
  Undo,
  Upload,
  User,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { normalizeWhitespace, replaceRepetitions } from "src/lib/chordpro";

import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import {
  generateSongIllustration,
  submitSongVersion,
} from "~/services/editor-service";
import { SongData } from "~/types/songData";
import { EditorState } from "~/types/types";
import DownloadButton from "./components/DownloadButton";
import EditorHelp from "./components/EditorHelp";
import SettingsDropdown from "./components/SettingsDropdown";
import { EditorSettings } from "./EditorSettings";

import {
  IMAGE_MODELS_API,
  SUMMARY_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
} from "src/worker/helpers/image-generator";
import { UserData } from "src/web/hooks/use-user-data";

interface EditorToolbarProps {
  editorState: EditorState;
  songData?: SongData;
  toolbarTop: boolean;
  canBeSubmitted: boolean;
  validationErrors: string[]; // <-- Added validation errors prop
  onBackupAndInitialize: () => void;
  onLoadBackup: () => void;
  onSubmitSuccess?: () => void;
  onUploadClick: () => void;
  userData: UserData;
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
  validationErrors,
  onBackupAndInitialize,
  onLoadBackup,
  onSubmitSuccess,
  onUploadClick,
  userData,
  editorSettings,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleLoginRedirect = () => {
    navigate({
      to: "/login",
      search: {
        redirect: location.pathname,
      },
    });
  };

  const generateIllustrationInBackground = (songId: string) => {
    generateSongIllustration(
      songId,
      IMAGE_MODELS_API[0], // "FLUX.1-dev"
      SUMMARY_PROMPT_VERSIONS[0], // "v4"
      SUMMARY_MODELS_API[0], // "gpt-5o-mini"
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

    const strippedChordpro = stripMetadataDirectives(editorState.chordpro);

    // Cast directly to EditorState here. This reassures TypeScript that
    // the required fields are definitively populated.
    const parsedState = {
      title: editorState.title,
      artist: editorState.artist,
      language: editorState.language,
      chordpro: normalizeWhitespace(replaceRepetitions(strippedChordpro)),
    } as EditorState;

    if (editorState.parentId) parsedState.parentId = editorState.parentId;

    // Only attach optional fields if they have truthy, non-empty values
    if (editorState.key?.trim()) parsedState.key = editorState.key;
    if (editorState.range?.trim()) parsedState.range = editorState.range;
    if (editorState.startMelody?.trim())
      parsedState.startMelody = editorState.startMelody;
    if (editorState.tempo?.toString().trim())
      parsedState.tempo = String(editorState.tempo);

    if (
      editorState.capo !== undefined &&
      editorState.capo !== null &&
      String(editorState.capo).trim() !== ""
    ) {
      parsedState.capo = Number(editorState.capo);
    }

    try {
      const response = await submitSongVersion(parsedState, songData?.id);

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
        userData &&
        userData.profile.isTrusted &&
        editorSettings.autoGenerateIllustration
      ) {
        generateIllustrationInBackground(response.song.id);
      }

      queryClient.invalidateQueries({ queryKey: ["songs"] });
      queryClient.invalidateQueries({ queryKey: ["versionsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songsAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["songDBAdmin"] });
      queryClient.invalidateQueries({ queryKey: ["submissions"] });

      if (userData && userData.profile.isAdmin) {
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
        {!userData ? (
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

        {userData ? (
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
              {/* Dynamically display the exact validation errors */}
              {validationErrors && validationErrors.length > 0 ? (
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-white font-medium">
                      {error}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {canBeSubmitted
                    ? "Ready to submit!"
                    : "Make some changes before submitting."}
                </p>
              )}
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
