import { describe, expect, it, vi } from "vitest";

// Local review must work without credentials or a connection to remote D1.
vi.mock("../shared/remote-db", () => { throw new Error("Unexpected remote dependency"); });
import { mergeItem } from "./common";

describe("local metadata review", () => {
  it("keeps saved fields and refreshes unsaved fields without loading remote D1", () => {
    const item = mergeItem({ youtubeSaved: true, youtubeId: "abcdefghijk", keySaved: false, key: "C" }, {
      songId: "song", title: "Song", artist: "Artist", youtubeId: null, key: "G", capo: 2,
    });
    expect(item).toMatchObject({ youtubeId: "abcdefghijk", key: "G", capo: 2 });
  });
});
