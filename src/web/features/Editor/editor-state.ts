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

export const parseMetadataFromChordPro = (content: string): Partial<EditorState> => {
  const extracted: Partial<EditorState> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*\{(?<key>[a-zA-Z]+):\s*(?<value>.*)\}\s*$/);
    if (match && match.groups) {
      const key = match.groups.key.toLowerCase();
      const value = match.groups.value.trim();

      if (key === "title" || key === "t") extracted.title = value;
      else if (key === "artist") extracted.artist = value;
      else if (key === "capo") {
        // Guard against NaN (e.g. while the user is mid-typing "{capo: }") so the
        // metadata field doesn't flash "NaN".
        const n = parseInt(value, 10);
        if (!Number.isNaN(n)) extracted.capo = n;
      }
      else if (key === "key") extracted.key = value;
      else if (key === "tempo") extracted.tempo = value;
      else if (key === "language") extracted.language = value;
      else if (key === "range") extracted.range = value;
      else if (key === "startmelody") extracted.startMelody = value;
    }
  }
  return extracted;
};
