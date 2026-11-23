export type PublicationRequest = { archivePrevious?: boolean; makeOfficial?: boolean };

export function publicationOptions(request: PublicationRequest, source: { imported: boolean; official: boolean }) {
  return {
    archivePrevious: source.imported || !!request.archivePrevious,
    makeOfficial: (source.imported && source.official) || !!request.makeOfficial,
  };
}

export function versionEditPolicy(version: {
  pending: boolean; imported: boolean; pendingCuration: boolean; official: boolean; ownerId?: string;
} | undefined, actor?: { id: string; isAdmin?: boolean }) {
  const canManage = !!actor && (version?.ownerId === actor.id || !!actor.isAdmin);
  const canEdit = !version?.pending || version.imported || canManage;
  const canCorrect = canEdit && (!version?.pending || canManage) &&
    (!version || version.pending || version.imported || version.official || canManage);
  return { canEdit, canCorrect, canManage };
}

type ReviewBase = {
  // Official selection when submitted; the target/source is recorded separately.
  baseOfficialVersionId: string | null;
  publication: PublicationRequest;
};
// Approval applies a correction to its target, keeping that version's identity.
export type CorrectionSubmission = ReviewBase & {
  kind: "correction";
  targetVersionId: string;
  baseRevision: number;
};
// Approval publishes an independently selectable version.
export type AlternativeSubmission = ReviewBase & {
  kind: "alternative";
  sourceVersionId: string | null;
  baseRevision: number | null;
};
export type SubmissionReview = CorrectionSubmission | AlternativeSubmission;

// Migration must classify old submissions before they can be approved.
// Null means invalid/missing metadata, not a third submission operation.
export function submissionReview(version: {
  parentId?: string | null;
  importId?: string | null;
  submissionIntent?: "update-parent" | "new-version" | null;
  baseRevision?: number | null;
  baseOfficialVersionId?: string | null;
  archivePreviousOnPublish?: boolean | null;
  makeOfficialOnPublish?: boolean | null;
}, _parentIsImported = false): SubmissionReview | null {
  const base = {
    baseOfficialVersionId: version.baseOfficialVersionId ?? null,
    publication: { archivePrevious: !!version.archivePreviousOnPublish, makeOfficial: !!version.makeOfficialOnPublish },
  };
  if (version.submissionIntent === "new-version") {
    return { ...base, kind: "alternative", sourceVersionId: version.parentId ?? null, baseRevision: version.baseRevision ?? null };
  }
  if (version.submissionIntent === "update-parent") {
    if (version.parentId && version.baseRevision != null && Number.isSafeInteger(version.baseRevision) && version.baseRevision > 0) {
      return { ...base, kind: "correction", targetVersionId: version.parentId, baseRevision: version.baseRevision };
    }
    return null;
  }
  return null;
}

export function isCorrectionSubmission(review: SubmissionReview | null): review is CorrectionSubmission {
  return review?.kind === "correction";
}
export function requiresImportRevision(imported: boolean, revision: number | undefined) {
  return imported && (revision ?? 1) <= 1;
}
