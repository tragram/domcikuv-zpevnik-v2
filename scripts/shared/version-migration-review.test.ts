import { expect, it } from "vitest";
import { buildImportArchival, buildReviewPairs, decisionMatches, versionHash, type ReviewVersion } from "./version-migration-review";

const root: ReviewVersion = { id: "a", parent_id: null, song_id: "song", title: "Song", artist: "Artist", status: "archived", chordpro: "[C]Hello world", created_at: 1 };
const next: ReviewVersion = { ...root, id: "b", parent_id: "a", status: "published", created_at: 2 };

it("never automatically consolidates independent roots", () => {
  expect(buildReviewPairs([root, { ...next, parent_id: null }])[0]).toMatchObject({ kind: "roots", proposed: "review" });
});

it("reuses a decision only for the same IDs and content hashes", () => {
  const pair = buildReviewPairs([root, next])[0];
  const decision = { ...pair, choice: "revision" as const, note: "Reviewed", updatedAt: "2026-11-17" };
  expect(decisionMatches(decision, pair)).toBe(true);
  const changedPair = buildReviewPairs([root, { ...next, chordpro: "Changed lyrics" }])[0];
  expect(decisionMatches(decision, changedPair)).toBe(false);
  expect(decisionMatches(decision, { ...pair, afterId: "other" })).toBe(false);
});

it("hashes are independent of SQLite column order and include metadata", () => {
  expect(versionHash(Object.fromEntries(Object.entries(root).reverse()) as ReviewVersion)).toBe(versionHash(root));
  expect(versionHash({ ...root, capo: 2 })).not.toBe(versionHash(root));
});

it("flags missing and cross-song parents", () => {
  expect(buildReviewPairs([next])[0]).toMatchObject({ proposed: "review", reason: "Missing or cross-song parent" });
  expect(buildReviewPairs([{ ...root, song_id: "other" }, next])[0].proposed).toBe("review");
});

it("classifies an edit of an imported parent as a revision even for major changes", () => {
  const imported = { ...root, import_id: "external-source" };
  const curated = { ...next, import_id: null, chordpro: "A substantially different curated sheet" };
  expect(buildReviewPairs([imported, curated])[0]).toMatchObject({ proposed: "revision", reason: "Imported parent → curated revision" });
  expect(buildReviewPairs([{ ...imported, song_id: "other" }, curated])[0].proposed).toBe("review");
});

it("keeps different-source raw imports separate even with identical lyrics", () => {
  const a = { ...root, import_id: "import-a" }, b = { ...next, import_id: "import-b" };
  const sources = new Map([["import-a", "cifraclub"], ["import-b", "pisnicky-akordy"]]);
  expect(buildReviewPairs([a, b], sources)[0].proposed).toBe("separate");
  expect(buildReviewPairs([a, { ...b, parent_id: null }], sources)[0].proposed).toBe("separate");
  expect(buildReviewPairs([a, b], new Map([["import-a", "same"], ["import-b", "same"]]))[0].proposed).toBe("review");
});

it("retires every live import when a curated version is published, retaining the curated official", () => {
  const a = { ...root, status: "published", import_id: "source-a" };
  const b = { ...a, id: "other-import", import_id: "source-b" };
  const pending = { ...a, id: "pending-import", status: "pending" };
  const archived = { ...a, id: "old-import", status: "archived" };
  const records = [a, b, pending, archived, next];
  const original = structuredClone(records);
  const plan = buildImportArchival(records, new Map([["song", "b"]]));
  expect(plan[0]).toMatchObject({ curatedId: "b", previousOfficialId: "b", preservePins: true });
  expect(plan[0].archiveImports.map((v) => v.id)).toEqual(["a", "other-import"]);
  expect(plan[0].archiveImports[0].hash).toBe(versionHash(a));
  expect(records).toEqual(original);
  expect(buildImportArchival([a, { ...next, status: "pending" }], new Map())).toEqual([]);
});

it("selects a curated official before proposing archival of an imported official", () => {
  const imported = { ...root, status: "published", import_id: "external" };
  expect(buildImportArchival([imported, next], new Map([["song", "a"]]))[0]).toMatchObject({ previousOfficialId: "a", curatedId: "b" });
});
