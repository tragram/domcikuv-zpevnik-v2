import { SongData, type SongMetadata } from "~/types/songData";

export const editorToChordPro = (metadata: SongMetadata, content: string) => {
  const songData = new SongData(metadata);
  // remove trailing and starting spaces and multiple empty lines
  content = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, arr) => line !== "" || arr[index - 1] !== "")
    .join("\n");
  songData.content = content;
  return {
    title: songData.title,
    artist: songData.artist,
    filename: `${songData.id || "song"}.pro`,
    chordProContent: songData.toChordpro(),
  };
};
