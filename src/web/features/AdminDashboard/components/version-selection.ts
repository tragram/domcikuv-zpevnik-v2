type SongWithCurrentVersion = { currentVersionId: string | null };
type VersionWithStatus = { id: string; status: string };
type RevisionSource = VersionWithStatus & { songId: string; parentId?: string | null; mergedIntoVersionId?: string | null; importId?: string | null };

export function getCorrectionParent<T extends RevisionSource>(source: RevisionSource, versions: T[]): T | undefined {
  if (!source.parentId || source.importId || source.mergedIntoVersionId || !["pending", "published", "archived"].includes(source.status)) return undefined;
  return versions.find((v) => v.id === source.parentId && v.songId === source.songId && v.id !== source.id &&
    !v.mergedIntoVersionId && ["published", "archived"].includes(v.status));
}

/** Selects the same version whose metadata represents a song in the admin row. */
export const getWorkingVersion = <T extends VersionWithStatus>(
  song: SongWithCurrentVersion,
  versions: T[],
): T | undefined =>
  versions.find((version) => version.id === song.currentVersionId) ??
  versions.find((version) => version.status === "published") ??
  versions.find((version) => version.status === "archived") ??
  versions.find((version) => version.status === "pending") ??
  versions.find((version) => version.status === "rejected");
