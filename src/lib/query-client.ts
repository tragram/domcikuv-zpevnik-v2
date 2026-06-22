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

async function setupPersistence() {
  try {
    await persistQueryClientRestore(persistOptions);
  } catch (e) {
    // A corrupt/unreadable cache must not block startup — fall back to fetching.
    console.warn("Failed to restore persisted query cache", e);
  }
  // Subscribe to save only AFTER restoring, so an early save can't overwrite the
  // good persisted cache with a half-built one.
  persistQueryClientSubscribe({
    ...persistOptions,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) &&
        query.state.status === "success",
    },
  });
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
