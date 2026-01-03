import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { API } from "src/worker/api-client";
import { fetchActiveSessions } from "~/services/users";
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

export const useActiveSessions = (
  songDB: SongDB,
  api: API,
) => {
  const queryClient = useQueryClient();
  const songs = songDB.songs;

  // Fetch active sessions using centralized config
  const { data: activeSessionsData, ...queryResult } = useQuery({
    ...activeSessionsQuery(api),
    // initialData: context.activeSessions,
  });

  // Map sessions with song data
  const activeSessions = activeSessionsData?.map((as) => ({
    ...as,
    song: songs.find((s) => s.id === as.songId),
  }));

  // Manual refetch function that checks if data is stale (> staleAgeInMinutes old)
  const refetchIfStale = (staleAgeInMinutes: number) => {
    const queryState = queryClient.getQueryState(
      activeSessionsQuery(api).queryKey
    );

    if (queryState?.dataUpdatedAt) {
      const ageInMinutes =
        (Date.now() - queryState.dataUpdatedAt) / (1000 * 60);
      if (ageInMinutes > staleAgeInMinutes) {
        queryClient.invalidateQueries({
          queryKey: activeSessionsQuery(api).queryKey,
        });
      }
    } else {
      // If no data exists yet, invalidate to trigger fetch
      queryClient.invalidateQueries({
        queryKey: activeSessionsQuery(api).queryKey,
      });
    }
  };

  return {
    activeSessions,
    refetchIfStale,
    ...queryResult,
  };
};
