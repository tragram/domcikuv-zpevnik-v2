import { queryOptions, useQuery } from "@tanstack/react-query";
import client from "src/worker/api-client";
import { UserProfileData } from "src/worker/api/userProfile";
import { fetchFavorites, fetchSubmissions } from "~/services/user-service";
import { authClient } from "src/lib/auth/client";
import { parseDBDates } from "../services/song-service";

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
  (sessionData?.user
    ? { loggedIn: true, profile: parseDBDates(sessionData.user) }
    : { loggedIn: false }) as UserProfileData;

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
    userProfile: sessionToProfile(sessionData),
    favorites: favorites ?? [],
    submissions: submissions ?? [],
    isSyncing: isAuthSyncing || isFavoritesSyncing || isSubmissionsSyncing,
  };
}

export async function getUserData() {
  const { data } = await authClient.getSession();
  return sessionToProfile(data);
}
