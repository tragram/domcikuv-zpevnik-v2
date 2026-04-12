import { queryOptions, useQuery } from "@tanstack/react-query";
import client from "src/worker/api-client";
import { UserProfileDB } from "src/worker/api/userProfile";
import { fetchFavorites, fetchSubmissions } from "~/services/user-service";
import { authClient } from "src/lib/auth/client";
import { parseDBDates } from "../services/song-service";
import { SongVersionApi } from "src/worker/api/api-types";

export type UserData = {
  profile: NonNullable<UserProfileDB>;
  submissions: SongVersionApi[];
  favoriteIds: Set<string>;
} | null;

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: ["session"],
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) {
        if (error.status === 401 || error.status === 403) return null;
        throw new Error(error.message || "Network error");
      }
      return data;
    },
  });

export const favoritesQueryOptions = (userId?: string) =>
  queryOptions({
    queryKey: ["favorites", userId],
    queryFn: () => fetchFavorites(client.api),
  });

export const submissionsQueryOptions = (userId?: string) =>
  queryOptions({
    queryKey: ["submissions", userId],
    queryFn: () => fetchSubmissions(),
  });

type SessionData = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>;

const sessionToProfile = (sessionData: SessionData | null | undefined) =>
  (sessionData?.user ? parseDBDates(sessionData.user) : null) as UserProfileDB;

export function useUserData() {
  const { data: sessionData, isPending: isAuthSyncing } = useQuery(
    sessionQueryOptions(),
  );

  const isLoggedIn = !!sessionData?.user;
  const userId = sessionData?.user?.id;
  const { data: favorites, isFetching: isFavoritesSyncing } = useQuery({
    ...favoritesQueryOptions(userId),
    enabled: isLoggedIn && !!userId,
  });

  const { data: submissions, isFetching: isSubmissionsSyncing } = useQuery({
    ...submissionsQueryOptions(userId),
    enabled: isLoggedIn && !!userId,
  });

  return {
    userData: isLoggedIn
      ? ({
          profile: sessionToProfile(sessionData),
          favoriteIds: favorites ? new Set(favorites) : new Set([]),
          submissions: submissions ?? [],
        } as UserData)
      : (null as UserData),
    isSyncing: isAuthSyncing || isFavoritesSyncing || isSubmissionsSyncing,
  };
}

export async function getUserData(): Promise<UserData> {
  const { data, error } = await authClient.getSession();

  // If there's an error or no user is logged in, return null
  if (error || !data?.user) {
    return null;
  }

  // Fetch favorites and submissions concurrently
  const [favorites, submissions] = await Promise.all([
    fetchFavorites(client.api),
    fetchSubmissions(),
  ]);

  return {
    profile: sessionToProfile(data),
    favoriteIds: favorites ? new Set(favorites) : new Set([]),
    submissions: submissions ?? [],
  } as UserData;
}
