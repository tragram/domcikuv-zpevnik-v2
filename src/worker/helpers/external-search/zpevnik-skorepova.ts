import { ExternalSearchResult } from "./index";

// Defining the expected structure based on the frontend's GraphQL fragment
interface ZpevnikSong {
  id: string;
  data: {
    slug: string;
    author: string;
    title: string;
  };
}

export async function searchZpevnikSkorepova(
  query: string,
  // Pass the Cloudflare environment bindings to access KV
  ZPEVNIK_CACHE: KVNamespace,
): Promise<ExternalSearchResult[]> {
  const CACHE_KEY = "zpevnik_skorepova_all_songs";
  let songs: ZpevnikSong[] = [];

  // 1. Attempt to fetch the entire songbook from the KV edge cache
  const cachedData = await ZPEVNIK_CACHE.get(CACHE_KEY, "json");
  if (cachedData && false) {
    songs = cachedData as ZpevnikSong[];
  } else {
    // 2. Cache miss: Fetch from the original GraphQL API
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
      if (!response.ok) return [];

      const json: any = await response.json();
      songs = json?.data?.songs || [];

      // 3. Store the result in KV with a 24-hour TTL (86400 seconds)
      if (songs.length > 0) {
        await ZPEVNIK_CACHE.put(CACHE_KEY, JSON.stringify(songs), {
          expirationTtl: 86400,
        });
      }
    } catch (error) {
      console.error("Error fetching Zpevnik Skorepova:", error);
      return [];
    }
  }

  // 4. Perform a local, case-insensitive search on the cached data
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
