import { SongData } from "~/types/songData";
import type { EditorState } from "~/types/types";

export function editorStateFromSong(song = SongData.empty(), versionId?: string): EditorState {
  const selectedId = versionId ?? song.versionId;
  return {
    ...song.toJSON(),
    label: song.versionLabel ?? undefined,
    description: song.versionDescription ?? undefined,
    expectedRevision: song.versionRevision,
    parentId: selectedId,
    baseVersionId: selectedId,
    saveMode: song.versionStatus === "pending" && song.submissionIntent === "new-version" ? "new-version" : undefined,
  };
}
