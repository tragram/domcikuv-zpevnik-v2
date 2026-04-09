import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import client from "src/worker/api-client";
import {
  buildSongDB,
  fetchPublicSongbooks,
  fetchSongs,
} from "~/services/song-service";
import { SongVersionDB } from "src/lib/db/schema";
import { UserProfileData } from "src/worker/api/userProfile";

export const songsQueryOptions = () =>
  queryOptions({
    queryKey: ["songs"],
    queryFn: () => fetchSongs(client.api),
  });

export const publicSongbooksQueryOptions = () =>
  queryOptions({
    queryKey: ["publicSongbooks"],
    queryFn: () => fetchPublicSongbooks(client.api),
    initialData: [],
  });

export function useSongDB(
  userProfile: UserProfileData,
  favoriteSongIds: string[] = [],
  submissions: SongVersionDB[] = [],
) {
  // TODO: update this to a single profile entity
  const { data: songs = [], isFetching: isSongsSyncing } =
    useQuery(songsQueryOptions());

  const { data: publicSongbooks = [] } = useQuery(
    publicSongbooksQueryOptions(),
  );

  // Rebuild the DB whenever the base songs, songbooks, or user favorites change
  const songDB = useMemo(
    () =>
      buildSongDB(
        songs,
        publicSongbooks,
        userProfile,
        favoriteSongIds,
        submissions,
      ),
    [songs, publicSongbooks, userProfile, favoriteSongIds, submissions],
  );

  return {
    songDB,
    isSyncing: isSongsSyncing,
  };
}
