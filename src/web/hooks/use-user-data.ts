import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryClient } from "src/lib/query-client";
import client from "src/worker/api-client";
import { UserProfileDB } from "src/worker/api/userProfile";
import { SongVersionDB } from "src/lib/db/schema";
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
    // Always revalidate so a just-completed login is picked up without a manual
    // reload (the persisted copy is still shown instantly).
    staleTime: 0,
    queryFn: async (): Promise<SessionData | null> => {
      const { data, error } = await authClient.getSession();
      if (!error) return data;
      // Explicit logout from the server.
      if (error.status === 401 || error.status === 403) return null;
      // Network error (offline): keep the last known session. This keeps the
      // PWA logged in offline AND keeps the query in "success" state so it stays
      // in the persisted cache (an "error" query is dropped on persist).
      const prev = queryClient.getQueryData<SessionData | null>(["session"]);
      if (prev !== undefined) return prev;
      throw new Error(error.message || "Network error");
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

export const sessionToProfile = (sessionData: SessionData | null | undefined) =>
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

  // Memoize so userData keeps a stable reference across renders (a fresh
  // `new Set(...)` each render would otherwise rebuild the whole SongDB in
  // useSongDB on every render).
  const userData = useMemo<UserData>(
    () =>
      isLoggedIn
        ? ({
            profile: sessionToProfile(sessionData),
            favoriteIds: favorites ? new Set(favorites) : new Set([]),
            submissions: submissions ?? [],
          } as UserData)
        : (null as UserData),
    [isLoggedIn, sessionData, favorites, submissions],
  );

  return {
    userData,
    isSyncing: isAuthSyncing || isFavoritesSyncing || isSubmissionsSyncing,
  };
}

export async function getUserData(): Promise<UserData> {
  // Resolve the session through the query cache so this shares the offline
  // behavior of sessionQueryOptions: when the network is unavailable we keep the
  // last known session instead of reporting a logged-in PWA user as logged-out
  // (which would otherwise bounce them to /login — itself unreachable offline).
  const data = await queryClient.ensureQueryData(sessionQueryOptions());

  if (!data?.user) {
    return null;
  }

  const userId = data.user.id;

  // Favorites/submissions may be unreachable offline; fall back to whatever is
  // already cached rather than failing the route load.
  const [favorites, submissions] = await Promise.all([
    queryClient
      .ensureQueryData(favoritesQueryOptions(userId))
      .catch(() => queryClient.getQueryData<string[]>(["favorites", userId])),
    queryClient
      .ensureQueryData(submissionsQueryOptions(userId))
      .catch(() =>
        queryClient.getQueryData<SongVersionDB[]>(["submissions", userId]),
      ),
  ]);

  return {
    profile: sessionToProfile(data),
    favoriteIds: favorites ? new Set(favorites) : new Set([]),
    submissions: submissions ?? [],
  } as UserData;
}
