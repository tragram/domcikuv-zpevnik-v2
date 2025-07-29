/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { SongDataApi, SongDBResponseData } from "../worker/api/songDB";
import client from "../worker/api-client";
import { handleApiResponse, makeApiRequest } from "./services/apiHelpers";

// Cache names
const SONGS_CACHE = "songs-db-cache";
const SONGS_METADATA_KEY = "songs-metadata";

type SongsCacheData = {
  songDBVersion: string;
  lastUpdateAt: string;
  songs: Map<string, SongDataApi>;
};

// Precache
precacheAndRoute(self.__WB_MANIFEST);
// Cleanup outdated caches
cleanupOutdatedCaches();

self.skipWaiting();
clientsClaim();

// Fallback for SPA routes - handle offline
let allowlist: undefined | RegExp[];
if (import.meta.env.DEV) allowlist = [/^\/$/];

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), { allowlist })
);

// Runtime caching for illustrations
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith("/songs/illustrations/");
  },
  new CacheFirst({
    cacheName: "full-illustration-cache",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Register custom route for /api/songs
registerRoute(
  ({ url }) => {
    return url.pathname === "/api/songs";
  },
  async ({ request }) => {
    return handleSongsRequest(request);
  }
);

// Handle other API routes with NetworkFirst strategy
registerRoute(
  ({ url }) => {
    return url.pathname.startsWith("/api/") && url.pathname !== "/api/songs";
  },
  new NetworkFirst({
    cacheName: "api-cache",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

const successJSendResponse = (data: object) => {
  return new Response(
    JSON.stringify({
      status: "success",
      data: data,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
};

async function getCachedMetadata(): Promise<SongsCacheData | null> {
  try {
    const cache = await caches.open(SONGS_CACHE);
    const dataResponse = await cache.match(SONGS_METADATA_KEY);
    if (!dataResponse) return null;

    const data = (await dataResponse.json()) as SongsCacheData;
    // Convert songs array back to Map for efficient operations
    const songsMap = new Map(data.songs || []);

    return {
      songDBVersion: data.songDBVersion,
      lastUpdateAt: data.lastUpdateAt,
      songs: songsMap,
    };
  } catch (error) {
    console.error("PWA: Error getting cached metadata:", error);
    return null;
  }
}

async function setCachedData(
  songDBVersion: string,
  lastUpdateAt: string,
  songs: Map<string, SongDataApi>
): Promise<void> {
  try {
    const cache = await caches.open(SONGS_CACHE);

    // Store metadata with songs as array of [key, value] pairs
    const data = {
      songDBVersion,
      lastUpdateAt,
      songs: Array.from(songs.entries()),
    };

    await cache.put(
      SONGS_METADATA_KEY,
      new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    console.error("Error setting cached data:", error);
  }
}

async function applyIncrementalUpdates(
  currentSongs: Map<string, SongDataApi>,
  updates: SongDataApi[]
): Promise<Map<string, SongDataApi>> {
  const updatedSongs = new Map(currentSongs);
  for (const song of updates) {
    if (song.updateStatus === "deleted") {
      updatedSongs.delete(song.id);
    } else {
      // For 'added' or 'modified' status, or no status (treat as upsert)
      updatedSongs.set(song.id, song);
    }
  }

  return updatedSongs;
}

// Custom handler for /api/songs endpoint
async function handleSongsRequest(request: Request): Promise<Response> {
  try {
    const cachedData = await getCachedMetadata();

    // If offline and we have cached data, return it
    if (!navigator.onLine && cachedData?.songs) {
      console.debug("PWA: Offline, serving cached songs data");
      const responseData = {
        songs: Array.from(cachedData.songs.values()),
        songDBVersion: cachedData.songDBVersion,
        lastUpdateAt: cachedData.lastUpdateAt,
        isIncremental: false,
      } as SongDBResponseData;
      return successJSendResponse(responseData);
    }

    // If no cached data, fetch full dataset
    if (
      !cachedData?.songs ||
      !cachedData.songDBVersion ||
      !cachedData.lastUpdateAt
    ) {
      console.debug("PWA: No cached data found, fetching full dataset");
      return fetchFullDataset();
    }

    // Try incremental update
    try {
      const data = await makeApiRequest(() =>
        client.api.songs.incremental.$get({
          query: {
            songDBVersion: cachedData.songDBVersion,
            lastUpdateAt: cachedData.lastUpdateAt,
          },
        })
      );

      // If not incremental (version mismatch), cache and return the full dataset
      if (!data.isIncremental) {
        console.log(
          "PWA: Version mismatch, caching full dataset from incremental endpoint"
        );
        const songsMap = new Map(data.songs.map((song) => [song.id, song]));
        await setCachedData(data.songDBVersion, data.lastUpdateAt, songsMap);
        return successJSendResponse(data);
      }

      // Apply incremental updates
      console.debug(`PWA: Applying ${data.songs.length} incremental updates`);
      const updatedSongs = await applyIncrementalUpdates(
        cachedData.songs,
        data.songs
      );

      // Update cache
      await setCachedData(data.songDBVersion, data.lastUpdateAt, updatedSongs);

      // Return the complete dataset from cache
      const responseData = {
        songs: Array.from(updatedSongs.values()),
        songDBVersion: data.songDBVersion,
        lastUpdateAt: data.lastUpdateAt,
        isIncremental: false, // From client perspective, it's the full dataset
      } as SongDBResponseData;
      return successJSendResponse(responseData);
    } catch (error) {
      console.warn("PWA: Incremental update failed, falling back:", error);

      // If we have cached data, serve it
      if (cachedData?.songs) {
        console.debug("PWA: Serving cached data as fallback");
        const responseData = {
          songs: Array.from(cachedData.songs.values()),
          songDBVersion: cachedData.songDBVersion,
          lastUpdateAt: cachedData.lastUpdateAt,
          isIncremental: false,
        } as SongDBResponseData;
        return successJSendResponse(responseData);
      }

      return fetchFullDataset();
    }
  } catch (error) {
    console.error("PWA: Error in handleSongsRequest:", error);
    // Fallback to network
    return fetch(request);
  }
}

async function fetchFullDataset(): Promise<Response> {
  try {
    const response = await client.api.songs.$get();
    const data = (await handleApiResponse(
      response.clone()
    )) as SongDBResponseData;

    // Cache the full dataset
    const songsMap = new Map(data.songs.map((song) => [song.id, song]));
    await setCachedData(data.songDBVersion, data.lastUpdateAt, songsMap);

    return response;
  } catch (error) {
    console.error("PWA: Failed to fetch full dataset:", error);

    // Try to serve cached data if available
    const cachedData = await getCachedMetadata();
    if (cachedData?.songs) {
      console.debug("PWA: Network failed, serving cached data");
      const responseData = {
        songs: Array.from(cachedData.songs.values()),
        songDBVersion: cachedData.songDBVersion,
        lastUpdateAt: cachedData.lastUpdateAt,
        isIncremental: false,
      } as SongDBResponseData;
      return successJSendResponse(responseData);
    }

    throw error;
  }
}
