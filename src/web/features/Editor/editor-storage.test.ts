import { describe, expect, it } from "vitest";

import {
  getEditorBackupKey,
  getEditorStateKey,
  parseMatchingLegacyDraft,
} from "./editor-storage";

describe("editor storage identity", () => {
  it("keeps drafts and backups separate for versions of the same song", () => {
    const first = getEditorStateKey("song-1", "version-1");
    const second = getEditorStateKey("song-1", "version-2");

    expect(first).toBe("editor/state/song-1/version-1");
    expect(second).toBe("editor/state/song-1/version-2");
    expect(first).not.toBe(second);
    expect(getEditorBackupKey(first)).toBe(`${first}-backup`);
    expect(getEditorBackupKey(first)).not.toBe(getEditorBackupKey(second));
  });

  it("keeps new-song and unversioned song drafts separate", () => {
    expect(getEditorStateKey()).toBe("editor/state");
    expect(getEditorStateKey("song-1")).toBe(
      "editor/state/song-1/unversioned",
    );
  });
});

describe("legacy editor draft migration", () => {
  const draft = {
    title: "Draft",
    artist: "Artist",
    chordpro: "Text",
    parentId: "version-1",
  };

  it("accepts a legacy draft only for its recorded parent version", () => {
    expect(
      parseMatchingLegacyDraft(JSON.stringify(draft), "version-1"),
    ).toEqual(draft);
    expect(
      parseMatchingLegacyDraft(JSON.stringify(draft), "version-2"),
    ).toBeNull();
  });

  it("rejects ambiguous or malformed legacy data", () => {
    expect(
      parseMatchingLegacyDraft(
        JSON.stringify({ ...draft, parentId: undefined }),
        "version-1",
      ),
    ).toBeNull();
    expect(parseMatchingLegacyDraft("not json", "version-1")).toBeNull();
    expect(parseMatchingLegacyDraft(JSON.stringify(draft))).toBeNull();
  });
});
