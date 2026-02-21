import { ExternalSearchResult } from "./index";

interface ZpevnikSong {
  id: string;
  data: {
    slug: string;
    author: string;
    title: string;
  };
}

// Define the structure for our new cache payload
interface CachedPayload {
  timestamp: number;
  songs: ZpevnikSong[];
}

export async function searchZpevnikSkorepova(
  query: string,
  ZPEVNIK_CACHE: KVNamespace,
): Promise<ExternalSearchResult[]> {
  const CACHE_KEY = "zpevnik_skorepova_all_songs";
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let songs: ZpevnikSong[] = [];
  let needsUpdate = true;

  // 1. Fetch from cache and check freshness
  const cachedData = await ZPEVNIK_CACHE.get(CACHE_KEY, "json");

  if (cachedData) {
    // Handle transition from the old array format to the new timestamped format
    if (Array.isArray(cachedData)) {
      songs = cachedData;
      needsUpdate = true;
    } else {
      const parsedData = cachedData as CachedPayload;
      songs = parsedData.songs;

      // Check if the data is older than one week
      const isStale = Date.now() - parsedData.timestamp > ONE_DAY_MS;
      needsUpdate = isStale;
    }
  }

  // 2. Fetch fresh data if needed (cache miss OR stale data)
  if (needsUpdate) {
    try {
      const response = await fetch(
        "https://zpevnik.skorepova.info/api/graphql",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operationName: null,
            query: `
            query {
              songs {
                id
                data {
                  slug
                  author
                  title
                  text
                }
              }
            }
          `,
          }),
        },
      );

      if (response.ok) {
        const json: any = await response.json();
        const fetchedSongs = json?.data?.songs || [];

        if (fetchedSongs.length > 0) {
          songs = fetchedSongs; // Update our working variable with fresh data

          // 3. Store the result permanently with a timestamp (NO expirationTtl)
          const payloadToCache: CachedPayload = {
            timestamp: Date.now(),
            songs: fetchedSongs,
          };
          await ZPEVNIK_CACHE.put(CACHE_KEY, JSON.stringify(payloadToCache));
        }
      } else {
        console.warn(
          "Zpevnik API returned a non-OK status. Falling back to cached data.",
        );
      }
    } catch (error) {
      // If the fetch fails (e.g., website down, DNS error), we just log it.
      // Because we didn't overwrite the 'songs' variable, the application
      // will gracefully continue using the stale data we loaded in step 1.
      console.error(
        "Failed to fetch fresh Zpevnik data. Using stale cache.",
        error,
      );
    }
  }

  // 4. Perform a local, case-insensitive search on the data
  const normalizedQuery = query.toLowerCase();
  return songs
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
      thumbnailURL: "zs_logo.png",
    }));
}
