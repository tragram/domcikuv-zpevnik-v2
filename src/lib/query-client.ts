import { QueryClient } from "@tanstack/react-query";
import {
  PersistedClient,
  Persister
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
