import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { API } from "src/worker/api-client";
import { fetchActiveSessions } from "~/services/user-service";
import { SongDB } from "~/types/types";

// Centralized query configuration
export const activeSessionsQuery = (api: API) => ({
  queryKey: ["activeSessions"] as const,
  queryFn: () => fetchActiveSessions(api),
  staleTime: 1000 * 60 * 60 * 24, // 24 hours
});

// Helper for prefetching in route loaders
export const prefetchActiveSessions = (queryClient: QueryClient, api: API) => {
  return queryClient.fetchQuery(activeSessionsQuery(api));
};

export const useActiveSessions = (songDB: SongDB, api: API) => {
  const queryClient = useQueryClient();
  const songs = songDB.songs;

  // Destructure refetch from useQuery directly
  const {
    data: activeSessionsData,
    refetch,
    ...queryResult
  } = useQuery({
    ...activeSessionsQuery(api),
  });

  // Map sessions with song data
  const activeSessions = activeSessionsData?.map((as) => ({
    ...as,
    song: songs.find((s) => s.id === as.songId),
  }));

  // Manual refetch function that checks if data is stale (> staleAgeInMinutes old)
  const refetchIfStale = useCallback(
    (staleAgeInMinutes: number) => {
      const queryState = queryClient.getQueryState(
        activeSessionsQuery(api).queryKey,
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
    [api, queryClient, refetch],
  );

  return {
    activeSessions,
    refetchIfStale,
    ...queryResult,
  };
};
