import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import client from "src/worker/api-client";
import {
  buildSongDB,
  fetchPublicSongbooks,
  fetchSongs,
} from "~/services/song-service";
import { UserData } from "./use-user-data";

import { QueryClient } from "@tanstack/react-query";
import { favoritesQueryOptions, sessionQueryOptions, submissionsQueryOptions, sessionToProfile, indexSongbookEntries } from "./use-user-data";

export const songsQueryOptions = () =>
  queryOptions({
    queryKey: ["songs"],
    queryFn: () => fetchSongs(client.api),
  });

export const publicSongbooksQueryOptions = () =>
  queryOptions({
    queryKey: ["publicSongbooks"],
    queryFn: () => fetchPublicSongbooks(client.api),
  });

export function useSongDB(
  userData: UserData,
) {
  const { data: songs = [], isFetching: isSongsSyncing } =
    useQuery(songsQueryOptions());

  const { data: publicSongbooks = [], isFetched: songbooksFetched } = useQuery(
    publicSongbooksQueryOptions(),
  );

  // Rebuild the DB whenever the base songs, songbooks, or user favorites change
  const songDB = useMemo(
    () =>
      buildSongDB(
        songs,
        publicSongbooks,
        userData,
      ),
    [songs, publicSongbooks, userData],
  );

  return {
    songDB,
    isSyncing: isSongsSyncing,
    // Whether the public-songbooks list has settled (resolved or errored) at least
    // once — distinct from `isSyncing`, which tracks only the songs query.
    songbooksFetched,
  };
}
// Force a re-sync of the song DB regardless of staleTime. `refetchType: "all"`
// also refreshes the queries while they're unmounted (e.g. from the admin
// dashboard), so the next song-list visit renders fresh data immediately.
// Cheap: fetchSongs goes through the incremental-sync endpoint.
export const refreshSongDB = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ["songs"], refetchType: "all" }),
    queryClient.invalidateQueries({
      queryKey: ["publicSongbooks"],
      refetchType: "all",
    }),
  ]);

export const getSongDB = async (queryClient: QueryClient) => {
  const songs = await queryClient.ensureQueryData(songsQueryOptions());
  const publicSongbooks = await queryClient.ensureQueryData(publicSongbooksQueryOptions());

  let userData: UserData | null = null;
  try {
    const session = await queryClient.ensureQueryData(sessionQueryOptions());
    if (session?.user?.id) {
      const userId = session.user.id;
      const [submissions, favorites] = await Promise.all([
        queryClient.ensureQueryData(submissionsQueryOptions(userId)),
        queryClient.ensureQueryData(favoritesQueryOptions(userId)),
      ]);

      userData = {
        profile: sessionToProfile(session)!,
        submissions: submissions ?? [],
        ...indexSongbookEntries(favorites),
      };
    }
  } catch (e) {
    console.warn("Failed to gather user context for SongDB buildup", e);
  }

  return buildSongDB(songs, publicSongbooks ?? [], userData);
};
