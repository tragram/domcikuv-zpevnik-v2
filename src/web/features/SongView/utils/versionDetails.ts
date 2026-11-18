import type { SongData } from "~/types/songData";
import type { UserData } from "~/hooks/use-user-data";
import type { FeedStatus } from "../hooks/useSessionSync";

import type { VersionSelection } from "src/lib/song-selection";
export type { VersionSelection } from "src/lib/song-selection";

export function getVersionDetails(
  song: SongData,
  userData: UserData | undefined,
  selection?: VersionSelection,
  feedStatus?: FeedStatus,
  resolvedStatus?: SongData["versionStatus"],
) {
  const following = !!feedStatus?.enabled && !feedStatus.isMaster;
  const author = song.customVersionAuthor;
  const isOwnVersion = !!author && author.id === userData?.profile.id;
  const submission = userData?.submissions.find((s) => s.id === song.versionId);
  const status = resolvedStatus ?? song.versionStatus ?? submission?.status;
  const label = song.isCustom
    ? (isOwnVersion ? "Your version" : "Custom version")
    : "Official version";

  let reason: string;
  if (following) {
    reason = `Following the version selected by ${feedStatus?.sessionState?.masterNickname ?? "the host"}.`;
  } else if (selection?.source === "link") {
    reason = "This link opens a specific version of the song.";
  } else if (selection?.source === "songbook") {
    const owner = selection.ownerName ? `${selection.ownerName}'s` : "the owner's";
    reason = selection.unavailable
      ? `The version saved in ${owner} songbook could not be loaded.`
      : `Showing the version from ${owner} songbook.`;
  } else if (selection?.source === "saved") {
    reason = selection.unavailable
      ? "Your saved version could not be loaded."
      : "You saved this version in your songbook.";
  } else {
    reason = song.isCustom
      ? "You are viewing a different version from the current official one."
      : "Showing the current official version of this song.";
  }

  const notes: string[] = [];
  if (selection?.unavailable) {
    notes.push("Saved version unavailable; showing official.");
  }

  const canPreview = !following;
  return {
    label,
    reason,
    notes,
    status: status ? {
      pending: "Awaiting approval",
      published: "Published",
      archived: "Archived",
      rejected: "Not approved",
      deleted: "Deleted",
    }[status] : undefined,
    author: author ? (isOwnVersion ? "you" : author.name) : undefined,
    canPreview,
    // Previewing another sheet is navigation. Keep the public songbook view
    // read-only; saving a personal choice happens after opening the preview.
    canChoose: !!userData && canPreview && selection?.source !== "songbook",
  };
}
