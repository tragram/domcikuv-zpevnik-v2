import { QueryClient } from "@tanstack/react-query";
import {
  persistQueryClientSave,
  persistQueryClientRestore,
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { openDB } from "idb";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: Infinity,
      staleTime: 1000 * 60 * 60, // 60 minutes
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
  },
});

const db = openDB("app-cache", 1, {
  upgrade(db) {
    db.createObjectStore("queries");
  },
});

const idbPersister: Persister = {
  persistClient: async (client: PersistedClient) => {
    const store = await db;
    const tx = store.transaction("queries", "readwrite");
    for (const query of client.clientState.queries) {
      const key = Array.isArray(query.queryKey)
        ? query.queryKey.join(":")
        : String(query.queryKey);
      await tx.store.put({ ...query, timestamp: client.timestamp }, key);
    }
    const existingKeys = await tx.store.getAllKeys();
    const activeKeys = new Set(
      client.clientState.queries.map((q) =>
        Array.isArray(q.queryKey) ? q.queryKey.join(":") : String(q.queryKey),
      ),
    );
    for (const key of existingKeys) {
      if (!activeKeys.has(key as string)) await tx.store.delete(key);
    }
    await tx.done;
  },

  restoreClient: async (): Promise<PersistedClient> => {
    const store = await db;
    const queries = await store.getAll("queries");
    return {
      timestamp: Date.now(),
      buster: "",
      clientState: { queries, mutations: [] },
    };
  },

  removeClient: async () => {
    const store = await db;
    await store.clear("queries");
  },
};

export const cacheRestored = persistQueryClientRestore({
  queryClient,
  persister: idbPersister,
});

queryClient.getQueryCache().subscribe(() => {
  persistQueryClientSave({ queryClient, persister: idbPersister });
});
