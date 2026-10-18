import type { ExternalSearchResult } from "src/lib/contracts/external-search-schema";

interface ZpevnikSong {
  id: string;
  version: number;
  data: {
    slug: string;
    author: string;
    title: string;
    text: string;
  };
}

// One NDJSON line of /api/song/changes: either a song or a deletion tombstone
type ZpevnikSongChange =
  | (ZpevnikSong & { deleted?: false })
  | { id: string; version: number; deleted: true };

export interface SkorepovaCache {
  timestamp: number;
  // Highest upstream version seen (including deletions); older cache versions don't have it
  version?: number;
  songs: ZpevnikSong[];
}

export const ZPEVNIK_SKOREPOVA_CACHE_KEY = "zpevnik_skorepova_all_songs";

/**
 * Downloads songs and deletions with a version greater than `after`
 * (or everything when `after` is undefined), ordered by version.
 */
async function downloadIsblChanges(
  after?: number,
): Promise<ZpevnikSongChange[]> {
  const url = new URL("https://zpevnik.skorepova.info/api/song/changes");
  if (after !== undefined) url.searchParams.set("after", String(after));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Zpevnik API returned status ${response.status}`);
  }

  if (
    response.headers.get("content-type")?.split(";")[0] !==
    "application/x-ndjson"
  ) {
    throw new Error(
      `Isabella broke the API contract again. It's no longer ndjson :scream:`,
    );
  }

  // Response is NDJSON: one entry per line
  return (await response.text())
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as ZpevnikSongChange);
}

/**
 * Applies downloaded entries on top of the cached songs, or replaces them
 * entirely when there is no cached version (full download). Returns the
 * merged songs and the highest version seen, including deletions.
 */
function mergeIsblEntries(
  songs: ZpevnikSong[],
  version: number | undefined,
  entries: ZpevnikSongChange[],
): { songs: ZpevnikSong[]; version: number } {
  const nextVersion = entries.reduce(
    (a, b) => (a > b.version ? a : b.version),
    version ?? 0,
  );
  if (!version) {
    return {
      version: nextVersion,
      songs: entries.filter((s) => !s.deleted),
    };
  }
  const merged = new Map(songs.map((song) => [song.id, song]));
  // entries are guaranteed to be ordered by version in ascending order
  for (const entry of entries) {
    if (entry.deleted) {
      merged.delete(entry.id);
    } else {
      merged.set(entry.id, entry);
    }
  }
  return { songs: Array.from(merged.values()), version: nextVersion };
}

async function refreshIsblCache(
  prev: SkorepovaCache | null,
): Promise<SkorepovaCache> {
  prev ??= { songs: [], version: undefined, timestamp: 0 };
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const ONE_MINUTE_MS = 60 * 1000;
  const isStale = Date.now() - prev.timestamp > ONE_DAY_MS;
  if (!isStale) return prev;

  try {
    const changes = await downloadIsblChanges(prev.version);
    const merged = mergeIsblEntries(prev.songs, prev.version, changes);

    return {
      ...merged,
      timestamp: Date.now(),
    };
  } catch (error) {
    // If the fetch fails (e.g., website down, DNS error, non-OK status),
    // we just log it.
    console.error(
      "Failed to fetch fresh Zpevnik data. Using stale cache.",
      error,
    );
    // request the upstream at most once per minute
    return {
      ...prev,
      timestamp: Date.now() - ONE_DAY_MS + ONE_MINUTE_MS,
    };
  }
}

export async function searchZpevnikSkorepova(
  query: string,
  ZPEVNIK_CACHE: KVNamespace,
): Promise<ExternalSearchResult[]> {
  // 1. Fetch from cache
  const cachedData = await ZPEVNIK_CACHE.get(
    ZPEVNIK_SKOREPOVA_CACHE_KEY,
    "json",
  );
  const parsedData = cachedData as SkorepovaCache | null;

  // 2. update the data (if needed)
  const freshData = await refreshIsblCache(parsedData);

  // 3. store it for the next time
  try {
    if (!parsedData || freshData.timestamp > parsedData.timestamp) {
      await ZPEVNIK_CACHE.put(
        ZPEVNIK_SKOREPOVA_CACHE_KEY,
        JSON.stringify(freshData),
      );
    }
  } catch (error) {
    console.error("Failed to update cache", error);
  }

  // 4. Perform a local, case-insensitive search on the data
  const normalizedQuery = query.toLowerCase();
  return freshData.songs
    .filter(
      (song) =>
        song.data.title.toLowerCase().includes(normalizedQuery) ||
        song.data.author.toLowerCase().includes(normalizedQuery),
    )
    .slice(0, 10)
    .map((song) => ({
      id: `zpevnik-skorepova/${song.id}`,
      title: song.data.title,
      artist: song.data.author || "Unknown Artist",
      url: `https://zpevnik.skorepova.info/song/${song.data.slug}`,
      sourceId: "zpevnik-skorepova",
      thumbnailURL: undefined,
    }));
}
