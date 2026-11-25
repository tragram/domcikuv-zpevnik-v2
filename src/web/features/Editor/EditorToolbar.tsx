import { useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
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
import React, { useLayoutEffect, useState } from "react";
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

import { UserData } from "src/web/hooks/use-user-data";
import { useIsOnline } from "src/web/hooks/use-is-online";
import { hasPendingAppUpdate, holdAppReload } from "~/services/app-updates";
import { refreshSongVersions } from "~/services/version-service";
import { OfflineToolbarBadge } from "~/components/OfflineIndicator";
import { EditorSubmitDialog, type EditorSaveChoice } from "./EditorSubmitDialog";

interface EditorToolbarProps {
  editorState: EditorState;
  songData?: SongData;
  /** Version opened by the route; authoritative for edit lineage. */
  versionId?: string;
  toolbarTop: boolean;
  canBeSubmitted: boolean;
  /** An admin approving a pending submission: changes optional, "Approve" wording. */
  isApprovalMode?: boolean;
  validationErrors: string[]; // <-- Added validation errors prop
  onBackupAndInitialize: () => void;
  onLoadBackup: () => void;
  onSubmitSuccess: (savedHere?: { songId: string; pending: boolean }) => void;
  onAttemptSubmit?: () => void;
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
  versionId,
  toolbarTop,
  canBeSubmitted,
  isApprovalMode = false,
  validationErrors,
  onBackupAndInitialize,
  onLoadBackup,
  onSubmitSuccess,
  onAttemptSubmit,
  onUploadClick,
  userData,
  editorSettings,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useIsOnline();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ publish: boolean } | null>(null);
  // Save options in this dialog stay local until the user confirms them.
  useLayoutEffect(() => {
    if (confirmation) return holdAppReload();
  }, [confirmation]);
  const queryClient = useQueryClient();

  const handleLoginRedirect = () => {
    navigate({
      to: "/login",
      search: {
        redirect: location.pathname,
      },
    });
  };

  const generateIllustrationInBackground = (songId: string, versionId?: string) => {
    generateSongIllustration(songId, versionId)
      .then(async (response) => {
        if (response.ok) {
          console.log(`Illustration generation started for song ${songId}`);
          toast.info("Illustration generation started in background");
        } else {
          const body = (await response.json().catch(() => null)) as {
            failData?: { message?: string };
            message?: string;
          } | null;
          const message =
            body?.failData?.message ?? body?.message ?? response.statusText;
          console.error("Failed to start illustration generation:", message);
          toast.error(`Failed to start illustration generation: ${message}`);
        }
      })
      .catch((error) => {
        console.error("Failed to generate illustration:", error);
        toast.error("Failed to start illustration generation");
      });
  };
  const handleSubmit = async (publish = isApprovalMode, choice?: EditorSaveChoice) => {
    setIsSubmitting(true);

    const strippedChordpro = stripMetadataDirectives(editorState.chordpro);

    // Cast directly to EditorState here. This reassures TypeScript that
    // the required fields are definitively populated.
    const parsedState = {
      title: editorState.title,
      artist: editorState.artist,
      language: editorState.language,
      label: choice?.label ?? editorState.label,
      description: choice?.description ?? editorState.description,
      baseVersionId: versionId,
      expectedRevision: editorState.expectedRevision,
      saveMode: choice?.saveMode,
      archivePreviousOnPublish: choice?.archivePreviousOnPublish,
      makeOfficialOnPublish: choice?.makeOfficialOnPublish,
      chordpro: normalizeWhitespace(replaceRepetitions(strippedChordpro)),
    } as EditorState;

    // A persisted draft is user content, not authority over which version is
    // being edited. Always submit against the version selected by the route.
    if (versionId) parsedState.parentId = versionId;

    // Only attach optional fields if they have truthy, non-empty values
    if (editorState.key?.trim()) parsedState.key = editorState.key;
    if (editorState.range?.trim()) parsedState.range = editorState.range;
    if (editorState.startMelody?.trim())
      parsedState.startMelody = editorState.startMelody;
    if (editorState.tempo?.toString().trim())
      parsedState.tempo = String(editorState.tempo);
    // Omitted when empty so the server clears it (schema transforms undefined -> null).
    if (editorState.youtubeId?.trim())
      parsedState.youtubeId = editorState.youtubeId;

    if (
      editorState.capo !== undefined &&
      editorState.capo !== null &&
      String(editorState.capo).trim() !== ""
    ) {
      parsedState.capo = Number(editorState.capo);
    }

    const releaseReload = holdAppReload();
    let saved: { songId: string; pending: boolean } | undefined;
    try {
      const response = await submitSongVersion(parsedState, songData?.id, {
        editAsPreviousAuthor: choice?.editAsPreviousAuthor,
        addToFavorites: choice?.addToFavorites,
        publish,
      });

      const version = response.version;
      saved = { songId: response.song.id, pending: version.status === "pending" };
      const isUpdate =
        new Date(version.createdAt).getTime() !==
        new Date(version.updatedAt).getTime();

      toast.success(
        response.version.status === "pending" ? "Changes submitted for approval" : isApprovalMode
          ? "Changes approved and published!"
          : `Successfully ${
              isUpdate ? "updated" : "submitted"
            } your version of the song!`,
      );

      const firstImportedSheetEdit = response.firstImportedSheetEdit;
      if (
        version.status === "published" &&
        (!versionId || version.id !== versionId || publish || firstImportedSheetEdit) &&
        !response.song.currentIllustrationId &&
        userData &&
        // matches the server's adminOrTrustedMiddleware on /illustrations
        (userData.profile.isTrusted || userData.profile.isAdmin) &&
        editorSettings.autoGenerateIllustration
      ) {
        generateIllustrationInBackground(response.song.id, firstImportedSheetEdit ? version.id : undefined);
      }

      // Await + force a refetch (not just "active" queries) so the caches are
      // fresh before we navigate. The song list + favorites feed buildSongDB
      // (favorites now carries the resolved pinned-draft song); submissions
      // feeds the editor's own drafts list. Without this, ensureQueryData hands
      // back the stale pre-edit version regardless of invalidation.
      // A second tab can stage an update while the editor remains open.
      // Acknowledgement of the write must not depend on loading another route.
      if (await hasPendingAppUpdate()) {
        onSubmitSuccess(saved);
        void refreshSongVersions(queryClient, response.song.id).catch((error) =>
          console.warn("Could not refresh the saved song", error));
        return;
      }
      await refreshSongVersions(queryClient, response.song.id);
      if (await hasPendingAppUpdate()) {
        onSubmitSuccess(saved);
        return;
      }

      if (userData && userData.profile.isAdmin) {
        await navigate({
          to: "/song/$songId",
          params: { songId: response.song.id },
        });
      } else {
        await navigate({ to: "/submissions" });
      }

      // Clear the persisted draft only *after* navigating away
      onSubmitSuccess();
    } catch (e) {
      if (saved) {
        onSubmitSuccess(saved);
        console.warn("Could not open the page after saving", e);
        return;
      }
      toast.error("Something went wrong during submission", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsSubmitting(false);
      releaseReload();
    }
  };

  const requestSubmit = (publish = isApprovalMode) => {
    if (songData) setConfirmation({ publish });
    else void handleSubmit(publish);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap w-auto mx-4 xl:mx-8 border-4 border-primary rounded-md max-md:justify-around md:justify-between",
        toolbarTop ? "mt-4 xl:mt-8" : "mb-4 xl:mb-8 ",
      )}
    >
      {/* links */}
      <nav aria-label="Site navigation" className="flex editor-toolbar-links">
        <Button variant="toolbar" asChild>
          <Link to="/">
            <Home />
            Home
          </Link>
        </Button>
        {!userData ? (
          <Button
            variant="toolbar"
            onClick={handleLoginRedirect}
          >
            <User />
            Login
          </Button>
        ) : (
          <Button variant="toolbar" asChild>
            <Link to="/submissions">
              <User />
              My edits
            </Link>
          </Button>
        )}
        <OfflineToolbarBadge className="self-center" />
      </nav>
      {/* editor actions */}
      <div className="flex editor-toolbar-actions flex-wrap justify-center">
        <EditorHelp />
        <Button
          variant="toolbar"
          onClick={onUploadClick}
        >
          Upload ChordPro
          <Upload />
        </Button>
        <Button
          variant="toolbar"
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
          variant="toolbar"
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
        {songData?.versionStatus === "pending" && !isApprovalMode && userData?.profile.isTrusted && (songData.submissionIntent !== "update-parent" || userData.submissions.some((v) => v.id === songData.versionParentId)) && <Button variant="toolbar" disabled={isSubmitting || !isOnline || validationErrors.length > 0} onClick={() => requestSubmit(true)}>Publish draft</Button>}

        {userData ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} onClick={() => onAttemptSubmit?.()}>
                <Button
                  isActive
                  className="rounded-none font-semibold"
                  onClick={() => requestSubmit()}
                  disabled={!canBeSubmitted || isSubmitting || !isOnline}
                >
                  {isApprovalMode
                    ? isSubmitting
                      ? "Approving..."
                      : "Approve changes"
                    : isSubmitting
                      ? "Submitting..."
                      : songData ? "Submit changes" : "Submit new song"}
                  <CloudUpload />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {/* Offline takes priority: the draft is saved locally, just can't sync. */}
              {!isOnline ? (
                <p>
                  You're offline — your draft is saved locally. Reconnect to
                  submit.
                </p>
              ) : validationErrors && validationErrors.length > 0 ? (
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="font-medium">
                      {error}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {isApprovalMode
                    ? canBeSubmitted
                      ? "Ready to approve!"
                      : "Approve the submission as-is, or make changes first."
                    : canBeSubmitted
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
                <Button variant="toolbar" disabled>
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
      {confirmation && songData && userData && <EditorSubmitDialog song={songData} state={editorState}
        actor={userData.profile} publishing={confirmation.publish} submitting={isSubmitting}
        onClose={() => setConfirmation(null)} onConfirm={(choice) => void handleSubmit(confirmation.publish, choice)} />}
    </div>
  );
};

export default EditorToolbar;
