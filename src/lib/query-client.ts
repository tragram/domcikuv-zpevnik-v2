import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import {
  PersistedClient,
  Persister,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      staleTime: 1000 * 60 * 60, // 60 minutes
      networkMode: "offlineFirst",
      retry: 1, // Fail fast to fallback to cache
      refetchOnWindowFocus: false,
    },
  },
});

export function createIDBPersister(idbValidKey: IDBValidKey = "reactQuery") {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get<PersistedClient>(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } satisfies Persister;
}

export const queryPersister = createIDBPersister();

// it invalidates everyone's offline cache - hand bump on changes
const CACHE_BUSTER = "v1";

const persistOptions = {
  queryClient,
  persister: queryPersister,
  // Never auto-evict: the offline song DB must survive months of being offline
  maxAge: Infinity,
  buster: CACHE_BUSTER,
};

let stopPersisting: (() => void) | undefined;
let persistenceCleared = false;

async function setupPersistence() {
  try {
    await persistQueryClientRestore(persistOptions);
  } catch (e) {
    // A corrupt/unreadable cache must not block startup — fall back to fetching.
    console.warn("Failed to restore persisted query cache", e);
  }
  // Subscribe to save only AFTER restoring, so an early save can't overwrite the
  // good persisted cache with a half-built one.
  if (persistenceCleared) return;
  stopPersisting = persistQueryClientSubscribe({
    ...persistOptions,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) &&
        query.state.status === "success" &&
        // Online-only search results, and SongData class instances would come
        // back from the snapshot as method-less plain objects anyway.
        query.queryKey[0] !== "externalSearch",
    },
  });
}

/**
 * Deletes the persisted offline snapshot and stops persisting for the rest of
 * this page's lifetime (so an in-flight query settling right before the reload
 * can't immediately re-save the state we just deleted). Used by the error
 * page's hard reload: the snapshot in IndexedDB is the one store that survives
 * localStorage/SW clearing, so leaving it in place would resurrect whatever
 * broken state sent the user here.
 */
export async function clearPersistedCache() {
  persistenceCleared = true;
  stopPersisting?.();
  await queryPersister.removeClient();
}

/**
 * Resolves once the persisted (offline) cache has been hydrated into the client.
 * The router's root route awaits this before running loaders, so a blocking loader
 * (e.g. the song route's `getSongDB`) never races an as-yet-unrestored cache — the
 * cause of a hard-reload-while-offline showing "no songs". The 5s race is a safety
 * net: the UI must never stay blank because IndexedDB stalled. The app shell itself
 * is NOT gated on this (it renders immediately); only route loaders wait.
 */
export const cacheRestored: Promise<unknown> =
  typeof indexedDB !== "undefined"
    ? Promise.race([
        setupPersistence(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ])
    : Promise.resolve();
