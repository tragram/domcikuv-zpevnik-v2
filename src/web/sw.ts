/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";
import { SongDBResponseData } from "../worker/api/songDB";
import client from "../worker/api-client";
import { handleApiResponse, makeApiRequest } from "./services/api-service";
import { SongDataApi } from "src/worker/api/api-types";

// --- Configuration ---

// Cache names
const CACHE_NAMES = {
  SONGS_DB: "songs-db-cache",
  THUMBNAILS: "thumbnail-cache",
  ILLUSTRATIONS: "full-illustration-cache",
  CRITICAL_API: "api-critical-cache", // Profile, Songbooks
  GENERIC_API: "api-general-cache",
};

const SONGS_METADATA_KEY = "songs-metadata";

// image limits to prevent infinite storage growth but it is generous
const CACHE_LIMITS = {
  IMAGES: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 }, // 1 Year
};

type SongsCacheData = {
  songDBVersion: string;
  lastUpdateAt: string;
  songs: Map<string, SongDataApi>;
};

// --- Lifecycle ---

// Precache
precacheAndRoute(self.__WB_MANIFEST);
// Cleanup outdated caches
cleanupOutdatedCaches();

self.skipWaiting();
clientsClaim();

// --- Routes ---

// 1. Navigation Fallback (SPA Support)
let allowlist: undefined | RegExp[];
if (import.meta.env.DEV) allowlist = [/^\/$/];

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    allowlist,
    denylist: [/^\/api\//, /^\/songs\//],
  }),
);

// 2. Heavy Media - CacheFirst
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/songs/illustrations/") &&
    !url.pathname.includes("/thumbnail/"),
  new CacheFirst({
    cacheName: CACHE_NAMES.ILLUSTRATIONS,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin(CACHE_LIMITS.IMAGES),
    ],
  }),
);

// 3. Songs Database - Custom SWR Strategy
// Handles /api/songs with custom incremental logic + StaleWhileRevalidate pattern
registerRoute(
  ({ url }) => url.pathname === "/api/songs",
  async ({ request, event }) => {
    return handleSongsRoute(request, event);
  },
);

// 4. Critical Blocking Data - StaleWhileRevalidate
// Profile and Songbooks.
registerRoute(
  ({ url }) => {
    return url.pathname === "/api/profile" || url.pathname === "/api/songs/songbooks";
  },
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.CRITICAL_API,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// 5. General API - NetworkFirst
// For other API calls (like searching users, admin actions), freshness is more important
registerRoute(
  ({ url }) => {
    return (
      url.pathname.startsWith("/api/") &&
      !url.pathname.startsWith("/api/auth") &&
      !url.pathname.startsWith("/api/profile") &&
      !url.pathname.startsWith("/api/songs")
    );
  },
  new NetworkFirst({
    cacheName: CACHE_NAMES.GENERIC_API,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// --- Helpers & Logic ---

const successJSendResponse = (data: object) => {
  return new Response(
    JSON.stringify({
      status: "success",
      data: data,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
};

async function getCachedMetadata(): Promise<SongsCacheData | null> {
  try {
    const cache = await caches.open(CACHE_NAMES.SONGS_DB);
    const dataResponse = await cache.match(SONGS_METADATA_KEY);
    if (!dataResponse) return null;

    const data = (await dataResponse.json()) as SongsCacheData;
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
  songs: Map<string, SongDataApi>,
): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAMES.SONGS_DB);
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
      }),
    );
  } catch (error) {
    console.error("Error setting cached data:", error);
  }
}

/**
 * Iterates through songs and caches their dynamic thumbnail URLs.
 * This ensures R2-hosted thumbnails are available offline even if not visited yet.
 */
async function cacheDynamicThumbnails(songs: SongDataApi[]): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAMES.THUMBNAILS);
    const urlsToCache = new Set<string>();

    for (const song of songs) {
      const thumbUrl = song.currentIllustration?.thumbnailURL;
      if (thumbUrl && typeof thumbUrl === "string") {
        // Only cache if it's a thumbnail delivered via CDN
        if (thumbUrl.startsWith("/cdn-cgi/image/width=128/")) {
          urlsToCache.add(thumbUrl);
        }
      }
    }

    if (urlsToCache.size > 0) {
      const urls = Array.from(urlsToCache);
      // We don't want to fail everything if one image fails
      await cache
        .addAll(urls)
        .catch((e) => console.warn("Thumb cache partial fail", e));
    }
  } catch (error) {
    console.warn("PWA: Error precaching dynamic thumbnails:", error);
  }
}

async function applyIncrementalUpdates(
  currentSongs: Map<string, SongDataApi>,
  updates: SongDataApi[],
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

/**
 * Custom Stale-While-Revalidate handler for the Songs DB.
 * 1. Checks Cache.
 * 2. If Cache exists -> Returns it immediately (Stale).
 * 3. Triggers Background Update (Revalidate) via event.waitUntil.
 * 4. If No Cache -> Awaits Network and returns it.
 */
async function handleSongsRoute(
  request: Request,
  event: ExtendableEvent,
): Promise<Response> {
  try {
    // 1. Try to get cached data
    const cachedData = await getCachedMetadata();

    // Define the update logic (Incremental or Full)
    const updateLogic = async () => {
      try {
        await performBackgroundUpdate(cachedData);
      } catch (err) {
        console.warn("PWA: Background update failed", err);
      }
    };

    // 2. SWR: If we have cache, return it and update in background
    if (cachedData?.songs) {
      console.debug("PWA: Serving cached songs (Stale)");

      // Trigger background update
      event.waitUntil(updateLogic());

      const responseData = {
        songs: Array.from(cachedData.songs.values()),
        songDBVersion: cachedData.songDBVersion,
        lastUpdateAt: cachedData.lastUpdateAt,
        isIncremental: false,
      } as SongDBResponseData;
      return successJSendResponse(responseData);
    }

    // 3. No Cache: Must wait for network
    console.debug("PWA: No cache, fetching full dataset");
    return await fetchFullDataset();
  } catch (error) {
    console.error("PWA: Error in handleSongsRoute:", error);
    // Ultimate fallback
    return fetch(request);
  }
}

/**
 * The logic to update the cache from the network.
 * Can be run in background (waitUntil) or foreground.
 */
async function performBackgroundUpdate(cachedData: SongsCacheData | null) {
  // If no cache metadata, we need a full fetch
  if (
    !cachedData?.songs ||
    !cachedData.songDBVersion ||
    !cachedData.lastUpdateAt
  ) {
    await fetchFullDataset();
    return;
  }

  // Try incremental
  try {
    console.debug("PWA: Checking for incremental updates...");
    const data = await makeApiRequest(() =>
      client.api.songs.incremental.$get({
        query: {
          songDBVersion: cachedData.songDBVersion,
          lastUpdateAt: cachedData.lastUpdateAt,
        },
      }),
    );

    // If version mismatch, the API returns isIncremental: false and the full dataset
    if (!data.isIncremental) {
      console.log("PWA: Version mismatch during update, caching full dataset");
      const songsMap = new Map(data.songs.map((song) => [song.id, song]));
      await setCachedData(data.songDBVersion, data.lastUpdateAt, songsMap);
      await cacheDynamicThumbnails(Array.from(songsMap.values()));
      return;
    }

    // Apply incremental updates
    if (data.songs.length > 0) {
      console.debug(`PWA: Applying ${data.songs.length} incremental updates`);
      const updatedSongs = await applyIncrementalUpdates(
        cachedData.songs,
        data.songs,
      );
      await setCachedData(data.songDBVersion, data.lastUpdateAt, updatedSongs);
      await cacheDynamicThumbnails(Array.from(updatedSongs.values()));
    } else {
      console.debug("PWA: No updates needed");
    }
  } catch (error) {
    console.warn(
      "PWA: Incremental update failed, trying full fetch fallback",
      error,
    );
    // If incremental fails significantly, try a full fetch to self-heal
    await fetchFullDataset();
  }
}

async function fetchFullDataset(): Promise<Response> {
  try {
    const response = await client.api.songs.$get();

    // We clone because we need to read the body for caching,
    // but also return the response to the browser/handler
    const data = (await handleApiResponse(
      response.clone(),
    )) as SongDBResponseData;

    const songsMap = new Map(data.songs.map((song) => [song.id, song]));
    await setCachedData(data.songDBVersion, data.lastUpdateAt, songsMap);

    // Don't await thumbnails here to keep response fast if running in foreground
    cacheDynamicThumbnails(data.songs).catch((e) => console.warn(e));

    return response;
  } catch (error) {
    console.error("PWA: Failed to fetch full dataset:", error);
    throw error;
  }
}
