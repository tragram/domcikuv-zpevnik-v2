import { expect, it } from "vitest";
import { SongData } from "./songData";

it("uses explicit official status independently of displayed author metadata", () => {
  const data = { id: "song", title: "Song", artist: "Artist", chordpro: "Lyrics",
    createdAt: "2026-01-01", updatedAt: "2026-01-01", externalSource: null,
    versionAuthor: { id: "owner", name: "Anna" } };
  expect(new SongData({ ...data, isOfficial: true }).isCustom).toBe(false);
  expect(new SongData({ ...data, isOfficial: false }).isCustom).toBe(true);
  expect(new SongData(data).isCustom).toBe(false);
  const alternative = new SongData({ ...data, isOfficial: false });
  const restored = new SongData(JSON.parse(JSON.stringify(alternative)));
  expect(restored.isCustom).toBe(true);
  expect(restored.versionAuthor).toEqual(data.versionAuthor);
});
