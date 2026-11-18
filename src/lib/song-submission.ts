import type {
  SongSubmissionDB,
  SongVersionDB,
  SongVersionWithSubmission,
} from "./db/schema";

// Keep existing wire contracts compatible while storing review state separately.
export function withSubmission(
  version: SongVersionDB,
  submission?: SongSubmissionDB | null,
): SongVersionWithSubmission {
  if (!submission) return version;
  const { versionId: _versionId, ...intent } = submission;
  return { ...version, ...intent };
}
