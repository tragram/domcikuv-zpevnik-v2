import { expect, it } from "vitest";
import { SongData } from "~/types/songData";
import { editorStateFromSong } from "./editor-state";

it("maps a persisted song to an edit without putting request fields into song serialization", () => {
  const song = new SongData({ id: "song", versionId: "version", title: "Song", artist: "Artist", chordpro: "[C]Lyrics",
    externalSource: null, createdAt: "2026-01-01", updatedAt: "2026-01-01", versionRevision: 4,
    versionLabel: "Acoustic", versionDescription: "One guitar", versionStatus: "pending", submissionIntent: "new-version" });
  const serialized = JSON.parse(JSON.stringify(song));
  expect(serialized.expectedRevision).toBeUndefined();
  expect(serialized.label).toBeUndefined();
  expect(editorStateFromSong(new SongData(serialized))).toMatchObject({
    label: "Acoustic", description: "One guitar", expectedRevision: 4,
    baseVersionId: "version", parentId: "version", saveMode: "new-version",
  });
});
