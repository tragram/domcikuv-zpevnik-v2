import { describe, expect, it } from "vitest";
import { SongData } from "~/types/songData";
import { editorSaveOptions } from "./editor-save-options";

const source = { sourceId: "pisnicky-akordy" as const, url: "https://example.test/song", originalContent: "Source" };
const curated = new SongData({
  id: "song", title: "Song", artist: "Artist", chordpro: "Curated", externalSource: null,
  createdAt: "2026-01-01", updatedAt: "2026-01-01", versionStatus: "published",
  isOfficial: true, versionAuthorId: "owner", versionParentIsImported: true,
});

describe("import editing rules", () => {
  it.each(["owner", "other"])("allows %s to suggest a normal correction to published curation", (id) => {
    expect(editorSaveOptions(curated, {}, { id }, false)).toMatchObject({
      canCorrect: true, saveMode: "correction", replacesImportedSource: false,
      archivePreviousOnPublish: false,
    });
  });

  it("lets the owner keep both alternatives when replacing a published curation", () => {
    expect(editorSaveOptions(curated, { saveMode: "new-version", archivePreviousOnPublish: false }, { id: "owner" }, true))
      .toMatchObject({ saveMode: "new-version", archivePreviousOnPublish: false });
  });

  it("preserves raw imports through a curated replacement", () => {
    expect(editorSaveOptions({ ...curated, externalSource: source }, {}, { id: "other" }, false))
      .toMatchObject({ canCorrect: false, saveMode: "new-version", archivePreviousOnPublish: true, makeOfficialOnPublish: true });
  });

  it("retains the initial curation's publication requests while it is pending", () => {
    expect(editorSaveOptions({ ...curated, isOfficial: false, versionStatus: "pending", makeOfficialOnPublish: true }, {}, { id: "owner" }, false))
      .toMatchObject({ replacesImportedSource: true, saveMode: "new-version", archivePreviousOnPublish: true, makeOfficialOnPublish: true });
  });

  it("requires a separate version when changing somebody else's non-official curation", () => {
    expect(editorSaveOptions({ ...curated, isOfficial: false }, {}, { id: "other" }, false))
      .toMatchObject({ canCorrect: false, saveMode: "new-version", archivePreviousOnPublish: false });
  });
});
