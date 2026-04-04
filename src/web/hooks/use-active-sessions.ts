import {
  QueryClient,
  queryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";
import client from "src/worker/api-client";
import { fetchActiveSessions } from "~/services/user-service";
import { SongDB } from "~/types/types";

// Centralized query configuration
export const activeSessionsQueryOptions = () =>
  queryOptions({
    queryKey: ["activeSessions"] as const,
    queryFn: () => fetchActiveSessions(client.api),
  });

// Helper for prefetching in route loaders
export const prefetchActiveSessions = (queryClient: QueryClient) => {
  return queryClient.fetchQuery(activeSessionsQueryOptions());
};

export const useActiveSessions = (songDB: SongDB) => {
  const queryClient = useQueryClient();
  const songs = songDB.songs;

  // Destructure refetch from useQuery directly
  const {
    data: activeSessionsData,
    refetch,
    ...queryResult
  } = useQuery(activeSessionsQueryOptions());

  // Map sessions with song data
  const activeSessions = activeSessionsData?.map((as) => ({
    ...as,
    song: songs.find((s) => s.id === as.songId),
  }));

  // Manual refetch function that checks if data is stale (> staleAgeInMinutes old)
  const refetchIfStale = useCallback(
    (staleAgeInMinutes: number) => {
      const queryState = queryClient.getQueryState(
        activeSessionsQueryOptions().queryKey,
      );

      if (queryState?.dataUpdatedAt) {
        const ageInMinutes =
          (Date.now() - queryState.dataUpdatedAt) / (1000 * 60);

        // If it's older than the allowed stale age, force an immediate refetch
        if (ageInMinutes >= staleAgeInMinutes) {
          refetch();
        }
      } else {
        // If no data exists yet, fetch immediately
        refetch();
      }
    },
    [queryClient, refetch],
  );

  return {
    activeSessions,
    refetchIfStale,
    ...queryResult,
  };
};
