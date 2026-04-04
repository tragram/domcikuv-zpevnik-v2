import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import client from "src/worker/api-client";
import {
    buildSongDB,
    fetchPublicSongbooks,
    fetchSongs,
} from "~/services/song-service";
import { useUserProfile } from "./use-user-profile";

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

export function useSongDB() {
  const { data: songs = [], isFetching: isSongsSyncing } = useQuery(
    songsQueryOptions(),
  );

  const { data: publicSongbooks } = useQuery(
    publicSongbooksQueryOptions(),
  );

  const { userProfile } = useUserProfile();

  const favoriteSongIds = useMemo(
    () => (userProfile?.loggedIn ? userProfile.profile.favoriteSongIds : []),
    [userProfile],
  );

  const songDB = useMemo(
    () => buildSongDB(songs, publicSongbooks, favoriteSongIds),
    [songs, publicSongbooks, favoriteSongIds],
  );

  return {
    songDB,
    isSyncing: isSongsSyncing,
  };
}
