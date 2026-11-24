import { expect, it } from "vitest";
import { isCorrectionSubmission, publicationOptions, submissionReview, versionEditPolicy } from "./song-version-policy";

it("accepts only classified corrections or alternatives", () => {
  expect(submissionReview({ submissionIntent: "update-parent", parentId: "parent", baseRevision: 3 }))
    .toMatchObject({ kind: "correction", targetVersionId: "parent", baseRevision: 3 });
  expect(submissionReview({ submissionIntent: "update-parent", parentId: "parent" })).toBeNull();
  expect(submissionReview({ submissionIntent: "new-version" })?.kind).toBe("alternative");
  expect(submissionReview({})).toBeNull();
  expect(isCorrectionSubmission(null)).toBe(false);
});

it("classifies imported-parent corrections as revisions", () => {
  const review = submissionReview({ submissionIntent: "update-parent", parentId: "raw", baseRevision: 1 }, true);
  expect(review).toMatchObject({ kind: "correction", targetVersionId: "raw" });
  expect(isCorrectionSubmission(review)).toBe(true);
});

it("shares mandatory imported-source retirement and official-replacement rules", () => {
  expect(publicationOptions({ archivePrevious: false, makeOfficial: false }, { imported: true, official: true }))
    .toEqual({ archivePrevious: true, makeOfficial: true });
  expect(publicationOptions({ archivePrevious: false, makeOfficial: false }, { imported: false, official: true }))
    .toEqual({ archivePrevious: false, makeOfficial: false });
});

it("allows corrections to published versions but keeps other authors' local drafts read-only", () => {
  const version = { pending: false, imported: false, official: true, ownerId: "owner" };
  expect(versionEditPolicy(version, { id: "other" }).canCorrect).toBe(true);
  expect(versionEditPolicy({ ...version, pending: true }, { id: "other" })).toMatchObject({ canEdit: false, canCorrect: false });
  expect(versionEditPolicy({ ...version, pending: true }, { id: "owner" }).canCorrect).toBe(true);
  expect(versionEditPolicy({ ...version, imported: true }, { id: "owner" }).canCorrect).toBe(true);
});
