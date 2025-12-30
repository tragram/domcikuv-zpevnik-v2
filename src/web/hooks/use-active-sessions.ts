import { useQuery, useQueryClient, QueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { API } from "src/worker/api-client";
import { fetchActiveSessions } from "~/services/users";

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

export const useActiveSessions = () => {
  const context = useRouteContext({ from: "/" });
  const queryClient = useQueryClient();
  const songs = context.songDB.songs;

  // Fetch active sessions using centralized config
  const { data: activeSessionsData, ...queryResult } = useQuery({
    ...activeSessionsQuery(context.api),
    initialData: context.activeSessions,
  });

  // Map sessions with song data
  const activeSessions = activeSessionsData?.map((as) => ({
    ...as,
    song: songs.find((s) => s.id === as.songId),
  }));

  // Manual refetch function that checks if data is stale (> staleAgeInMinutes old)
  const refetchIfStale = (staleAgeInMinutes: number) => {
    const queryState = queryClient.getQueryState(
      activeSessionsQuery(context.api).queryKey
    );

    if (queryState?.dataUpdatedAt) {
      const ageInMinutes =
        (Date.now() - queryState.dataUpdatedAt) / (1000 * 60);
      if (ageInMinutes > staleAgeInMinutes) {
        queryClient.invalidateQueries({
          queryKey: activeSessionsQuery(context.api).queryKey,
        });
      }
    } else {
      // If no data exists yet, invalidate to trigger fetch
      queryClient.invalidateQueries({
        queryKey: activeSessionsQuery(context.api).queryKey,
      });
    }
  };

  return {
    activeSessions,
    refetchIfStale,
    ...queryResult,
  };
};
