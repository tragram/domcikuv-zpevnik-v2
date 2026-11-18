import type { SongbookEntryApi, SongDataApi } from "src/worker/api/api-types";

export type VersionSelection = {
  source: "official" | "saved" | "songbook" | "link";
  ownerName?: string;
  unavailable?: boolean;
};

/** Both the list and song navigation use the server-resolved pin, or official. */
export function songbookSheet(official: SongDataApi | undefined, entry?: SongbookEntryApi) {
  const sheet = entry?.song ?? official;
  return sheet && sheet !== official && official?.publishedVersionIds
    ? { ...sheet, publishedVersionIds: official.publishedVersionIds } : sheet;
}

/** Explicit links override a book; a selected book never inherits your own pin. */
export function selectSongVersion({ official, ownEntry, songbook, versionId }: {
  official?: SongDataApi;
  ownEntry?: SongbookEntryApi;
  songbook?: { entry?: SongbookEntryApi; ownerName?: string };
  versionId?: string;
}) {
  const entry = songbook ? songbook.entry : ownEntry;
  const source: VersionSelection["source"] = versionId ? "link"
    : songbook ? "songbook" : ownEntry?.pinnedVersionId ? "saved" : "official";
  return {
    // On exact links this is only a cache candidate, never a fallback.
    sheet: versionId ? songbookSheet(official, ownEntry) : songbookSheet(official, entry),
    source,
    pinnedVersionId: versionId ? undefined : entry?.pinnedVersionId,
    ownerName: songbook?.ownerName,
    personalizationOverride: !versionId && songbook && entry
      ? { keyIndex: entry.keyIndex, capo: entry.capo } : undefined,
  };
}

/** Shared eligibility for offline choices: published, shown/saved archived, own pending. */
export function selectableVersionIds({ song, savedEntry, submissions = [] }: {
  song: { id: string; versionId?: string; versionStatus?: string; publishedVersionIds?: readonly string[] };
  savedEntry?: SongbookEntryApi;
  submissions?: readonly { id: string; songId: string; status: string }[];
}) {
  const ids = new Set(song.publishedVersionIds);
  if (song.versionId && song.versionStatus === "archived") ids.add(song.versionId);
  if (savedEntry?.song?.versionStatus === "archived" && savedEntry.song.versionId) ids.add(savedEntry.song.versionId);
  for (const version of submissions) {
    if (version.songId === song.id && version.status === "pending") ids.add(version.id);
  }
  return ids;
}
