// Keep persisted key shapes stable. Definitions and mutation invalidation use
// the same roots so adding a dependent view cannot silently miss refreshes.
export const songQueryKeys = {
  catalog: ["songs"] as const,
  catalogMeta: ["songs-meta"] as const,
  sheets: ["song"] as const,
  versions: ["songVersions"] as const,
  revisions: ["songRevisions"] as const,
  favorites: ["favorites"] as const,
  songbooks: ["songbookEntries"] as const,
  publicSongbooks: ["publicSongbooks"] as const,
  submissions: ["submissions"] as const,
  adminVersions: ["versionsAdmin"] as const,
  adminSongs: ["songsAdmin"] as const,
  adminCatalog: ["songDBAdmin"] as const,
  sheet: (songId: string, versionId?: string) => versionId
    ? ["song", "fetch", songId, versionId] as const : ["song", "fetch", songId] as const,
  versionList: (songId: string, viewerId?: string, shownVersionId?: string) =>
    ["songVersions", songId, viewerId ?? "public", shownVersionId ?? ""] as const,
  revisionPage: (songId: string, versionId: string, viewerId: string, offset: number) =>
    ["songRevisions", songId, versionId, viewerId, offset] as const,
  userFavorites: (userId?: string) => ["favorites", userId] as const,
  userSongbook: (userId: string) => ["songbookEntries", userId] as const,
  userSubmissions: (userId?: string) => ["submissions", userId] as const,
  feedSheet: (songId?: string | null, versionId?: string | null, revision?: number | null) =>
    ["song", "feed", songId, versionId, revision ?? null] as const,
};

export const versionRefreshKeys = [
  songQueryKeys.catalog, songQueryKeys.sheets, songQueryKeys.versions, songQueryKeys.revisions,
  songQueryKeys.favorites, songQueryKeys.songbooks, songQueryKeys.publicSongbooks,
  songQueryKeys.submissions, songQueryKeys.adminVersions, songQueryKeys.adminSongs, songQueryKeys.adminCatalog,
];
