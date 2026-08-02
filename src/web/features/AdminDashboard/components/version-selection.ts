type SongWithCurrentVersion = { currentVersionId: string | null };
type VersionWithStatus = { id: string; status: string };

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
