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
    expect(editorSaveOptions(curated, {}, { id })).toMatchObject({
      canCorrect: true, saveMode: "correction", replacesImportedSource: false,
      archivePreviousOnPublish: false,
    });
  });

  it("lets the owner keep both alternatives when replacing a published curation", () => {
    expect(editorSaveOptions(curated, { saveMode: "new-version", archivePreviousOnPublish: false }, { id: "owner" }))
      .toMatchObject({ saveMode: "new-version", archivePreviousOnPublish: false });
  });

  it("recommends a correction for an imported sheet", () => {
    expect(editorSaveOptions({ ...curated, externalSource: source }, {}, { id: "other" }))
      .toMatchObject({ canCorrect: true, saveMode: "correction", archivePreviousOnPublish: false, makeOfficialOnPublish: false });
  });

  it("keeps pending import corrections as corrections", () => {
    expect(editorSaveOptions({ ...curated, isOfficial: false, versionStatus: "pending", makeOfficialOnPublish: true }, {}, { id: "owner" }))
      .toMatchObject({ replacesImportedSource: true, saveMode: "correction", archivePreviousOnPublish: false, makeOfficialOnPublish: false });
  });

  it("requires a separate version when changing somebody else's non-official curation", () => {
    expect(editorSaveOptions({ ...curated, isOfficial: false }, {}, { id: "other" }))
      .toMatchObject({ canCorrect: false, saveMode: "new-version", archivePreviousOnPublish: false });
  });
});
