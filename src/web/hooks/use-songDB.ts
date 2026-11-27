import { queryOptions, useQuery } from "@tanstack/react-query";
import memoizeOne from "memoize-one";
import type { SongDataApi } from "src/worker/api/api-types";
import type { Songbook } from "~/types/types";
import {
  buildSongDB,
  fetchPublicSongbooks,
  fetchSongs,
} from "~/services/song-service";
import { UserData } from "./use-user-data";
import { songQueryKeys } from "~/services/song-query-keys";

import { QueryClient } from "@tanstack/react-query";
import {
  favoritesQueryOptions,
  sessionQueryOptions,
  submissionsQueryOptions,
  sessionToProfile,
  indexSongbookEntries,
} from "./use-user-data";

export const songsQueryOptions = () =>
  queryOptions({
    queryKey: songQueryKeys.catalog,
    queryFn: ({ client }) => fetchSongs(client),
    staleTime: import.meta.env.DEV ? 0 : 24 * 60 * 60_000,
  });

export const publicSongbooksQueryOptions = () =>
  queryOptions({
    queryKey: songQueryKeys.publicSongbooks,
    queryFn: () => fetchPublicSongbooks(),
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

const emptyCatalog: SongDataApi[] = [];
const emptySongbooks: Songbook[] = [];
// SongView and SongList both use the same catalog and query snapshots.
const deriveSongDB = memoizeOne(buildSongDB);

export function useSongDB(userData: UserData) {
  const { data: songs = emptyCatalog, isFetching: isSongsSyncing } =
    useQuery(songsQueryOptions());

  const {
    data: publicSongbooks = emptySongbooks,
    isFetched: songbooksFetched,
  } = useQuery(publicSongbooksQueryOptions());

  const songDB = deriveSongDB(songs, publicSongbooks, userData);

  return {
    songDB,
    catalog: songs,
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
    queryClient.invalidateQueries({
      queryKey: songQueryKeys.catalog,
      refetchType: "all",
    }),
    queryClient.invalidateQueries({
      queryKey: songQueryKeys.publicSongbooks,
      refetchType: "all",
    }),
  ]);

export const getSongDB = async (queryClient: QueryClient) => {
  const songs = await queryClient.ensureQueryData(songsQueryOptions());
  const publicSongbooks = await queryClient.ensureQueryData(
    publicSongbooksQueryOptions(),
  );

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

export const refreshAll = (queryClient: QueryClient, userId?: string) =>
  Promise.all([
    refreshSongDB(queryClient),
    ...(userId
      ? [
          queryClient.invalidateQueries({
            queryKey: favoritesQueryOptions(userId).queryKey,
            refetchType: "all",
          }),
          queryClient.invalidateQueries({
            queryKey: submissionsQueryOptions(userId).queryKey,
            refetchType: "all",
          }),
        ]
      : []),
  ]);
