import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryClient } from "src/lib/query-client";
import client from "src/worker/api-client";
import type { UserProfileDB } from "src/worker/api/userProfile";
import { SongVersionDB } from "src/lib/db/schema";
import { fetchFavorites, fetchSubmissions } from "~/services/user-service";
import { makeApiRequest } from "~/services/api-service";
import { authClient } from "src/lib/auth/client";
import { parseDBDates } from "../services/song-service";
import type { SongbookEntryApi, SongVersionApi } from "src/worker/api/api-types";

export type UserData = {
  profile: NonNullable<UserProfileDB>;
  submissions: SongVersionApi[];
  // Set of favorited song ids (membership). Derived from songbookEntries.
  favoriteIds: Set<string>;
  // Per-song personal pin / key / capo, keyed by songId.
  songbookEntries: Map<string, SongbookEntryApi>;
} | null;

// Build the membership Set + per-song Map from the favorites payload.
export const indexSongbookEntries = (entries: SongbookEntryApi[] | undefined) => {
  const list = entries ?? [];
  return {
    favoriteIds: new Set(list.map((e) => e.songId)),
    songbookEntries: new Map(list.map((e) => [e.songId, e])),
  };
};

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
      // Never logged in (no cached session) AND offline: report logged-out rather
      // than throwing
      return null;
    },
  });

export const favoritesQueryOptions = (userId?: string) =>
  queryOptions({
    queryKey: ["favorites", userId],
    queryFn: () => fetchFavorites(client.api),
  });

// Another user's public songbook entries (their saved key/capo, and pinned
// drafts inline). Kept off the shared SongDB plumbing so it never pushes
// Maps/Sets into the persisted filter store.
export const songbookEntriesQueryOptions = (ownerId: string) =>
  queryOptions({
    queryKey: ["songbookEntries", ownerId],
    queryFn: (): Promise<SongbookEntryApi[]> =>
      makeApiRequest(() =>
        client.api.favorites.of[":userId"].$get({ param: { userId: ownerId } }),
      ),
  });

/**
 * Reads one song's songbook entry (and whether it's a favorite) from the *live*
 * favorites cache, so optimistic add/remove and auto-saved key/capo are picked
 * up immediately. Falls back to the song's frozen loader snapshot
 * (`fallbackIsFavorite`) only while the cache is still cold. Shared by the heart
 * toggle and the song-view transpose hook so "is it a favorite / what's saved"
 * is read in exactly one way.
 */
export function useSongbookEntry(
  songId: string,
  userId: string | undefined,
  fallbackIsFavorite: boolean,
) {
  const { data: favorites } = useQuery({
    ...favoritesQueryOptions(userId),
    enabled: !!userId,
  });
  const entry = favorites?.find((e) => e.songId === songId);
  return {
    entry,
    isFavorite: favorites ? !!entry : fallbackIsFavorite,
  };
}

/**
 * The single place that writes the `["favorites", userId]` cache — membership
 * (add/remove) and the per-song key/capo patch all flow through here, so the
 * entry shape and query key live in one spot. Pure cache writes; callers keep
 * their own cancel/snapshot/rollback.
 */
export function addFavoriteEntry(
  queryClient: QueryClient,
  userId: string | undefined,
  entry: SongbookEntryApi,
) {
  queryClient.setQueryData<SongbookEntryApi[]>(
    favoritesQueryOptions(userId).queryKey,
    (old = []) =>
      old.some((e) => e.songId === entry.songId) ? old : [...old, entry],
  );
}

export function removeFavoriteEntry(
  queryClient: QueryClient,
  userId: string | undefined,
  songId: string,
) {
  queryClient.setQueryData<SongbookEntryApi[]>(
    favoritesQueryOptions(userId).queryKey,
    (old = []) => old.filter((e) => e.songId !== songId),
  );
}

export function patchFavoriteEntry(
  queryClient: QueryClient,
  userId: string | undefined,
  songId: string,
  patch: Partial<SongbookEntryApi>,
) {
  queryClient.setQueryData<SongbookEntryApi[]>(
    favoritesQueryOptions(userId).queryKey,
    (old) => old?.map((e) => (e.songId === songId ? { ...e, ...patch } : e)),
  );
}

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

// Reads the current user's id straight from the session cache, without
// subscribing to it (for one-off loader checks, e.g. "is this the viewer's
// own songbook?").
export const getSessionUserId = (queryClient: QueryClient) =>
  queryClient.getQueryData<SessionData | null>(sessionQueryOptions().queryKey)
    ?.user?.id;

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
            ...indexSongbookEntries(favorites),
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
      .catch(() =>
        queryClient.getQueryData<SongbookEntryApi[]>(["favorites", userId]),
      ),
    queryClient
      .ensureQueryData(submissionsQueryOptions(userId))
      .catch(() =>
        queryClient.getQueryData<SongVersionDB[]>(["submissions", userId]),
      ),
  ]);

  return {
    profile: sessionToProfile(data),
    ...indexSongbookEntries(favorites),
    submissions: submissions ?? [],
  } as UserData;
}

/**
 * Like getUserData, but revalidates the session first instead of trusting the
 * persisted copy (which can be stale in both directions: still logged-out right
 * after an OAuth callback, still logged-in after the cookie expired). Never
 * throws — offline or failed fetches degrade to cached data / logged-out.
 */
export async function refreshUserData(): Promise<UserData> {
  await queryClient.fetchQuery(sessionQueryOptions()).catch(() => undefined);
  return getUserData().catch(() => null);
}
