import { SongDataDB } from "src/lib/db/schema";
import { queryClient } from "src/lib/query-client";
import type {
  ModifySongVersionSchema,
  SongModificationSchema,
} from "src/worker/api/admin/songs";
import type {
  SongDataAdminApi,
  SongDataApi,
  SongVersionAdminApi,
  SongVersionApi,
  SongVersionSummaryApi,
} from "src/worker/api/api-types";
import type { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import type { ExternalSearchResult } from "src/lib/contracts/external-search-schema";
import client, { AdminApi } from "~/../worker/api-client";
import { SongData } from "~/types/songData";
import {
  isValidSongLanguage,
  LanguageCount,
  Songbook,
  SongDB,
  SongLanguage,
} from "~/types/types";
import { UserData } from "../hooks/use-user-data";
import { makeApiRequest } from "./api-service";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import { getIsOnline } from "~/hooks/use-is-online";
import { songbookSheet } from "src/lib/song-selection";
import { songQueryKeys } from "./song-query-keys";
import { unavailableSheet } from "src/lib/offline-sheets";

interface Timestamped {
  createdAt?: Date | string;
  updatedAt?: Date | string;
  approvedAt?: Date | string | null;
  lastLogin?: Date | string | null;
}
export const parseDBDates = <T extends Timestamped>(o: T) => {
  return {
    ...o,
    createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
    updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
    approvedAt: o.approvedAt
      ? new Date(o.approvedAt)
      : o.approvedAt === null
        ? null
        : undefined,
    lastLogin: o.lastLogin
      ? new Date(o.lastLogin)
      : o.lastLogin === null
        ? null
        : undefined,
  };
};

// --- Public API ---
type SongsMeta = {
  version: string;
  lastUpdate: string;
};

const setSongsMeta = (data: { songDBVersion: string; lastUpdateAt: string }) =>
  queryClient.setQueryData<SongsMeta>(songQueryKeys.catalogMeta, {
    version: data.songDBVersion,
    lastUpdate: data.lastUpdateAt,
  });

export const fetchSongs = async (): Promise<SongDataApi[]> => {
  // 1. Get current cached state from TanStack/IndexedDB
  const cached = queryClient.getQueryData<SongDataApi[]>(songQueryKeys.catalog);
  const meta = queryClient.getQueryData<SongsMeta>(songQueryKeys.catalogMeta);

  // The admin-managed DB version determines when the server sends a replacement.
  if (!cached || !meta?.version || !meta.lastUpdate) {
    try {
      const data = await makeApiRequest(client.api.songs.$get);
      setSongsMeta(data);
      return data.songs;
    } catch (error) {
      // Never error the query while a cache exists (an errored query is dropped
      // on persist, which would wipe the offline songs — see sessionQueryOptions
      // for the same rule). The full fetch simply retries on a later launch.
      if (cached) {
        console.warn("Full song fetch failed, returning cache", error);
        return cached;
      }
      throw error;
    }
  }

  // 3. Try Incremental Update
  try {
    const data = await makeApiRequest(() =>
      client.api.songs.incremental.$get({
        query: { songDBVersion: meta.version, lastUpdateAt: meta.lastUpdate },
      }),
    );
    // 4. Handle Full Reset (isIncremental: false)
    if (!data.isIncremental) {
      setSongsMeta(data);
      return data.songs;
    }

    // 5. Apply Incremental Updates (matches your applyIncrementalUpdates)
    if (data.songs.length > 0) {
      const songMap = new Map(cached.map((s) => [s.id, s]));

      for (const song of data.songs) {
        if (song.updateStatus === "deleted") {
          songMap.delete(song.id);
        } else {
          songMap.set(song.id, song);
        }
      }

      setSongsMeta(data);
      return Array.from(songMap.values());
    }

    // No updates needed
    return cached;
  } catch (error) {
    console.warn("Incremental fetch failed, returning cache", error);
    return cached;
  }
};

export const singleSongQueryOptions = (songId: string, versionId?: string) =>
  queryOptions({
    queryKey: songQueryKeys.sheet(songId, versionId),
    queryFn: async () => {
      if (versionId) {
        return (await makeApiRequest(() =>
          client.api.songs.fetch[":songId"][":versionId"].$get({
            param: { songId, versionId },
          }),
        )) as SongDataApi;
      } else {
        return (await makeApiRequest(() =>
          client.api.songs.fetch[":id"].$get({
            param: { id: songId },
          }),
        )) as SongDataApi;
      }
    },
  });

export const songVersionsQueryOptions = (songId: string, viewerId?: string, shownVersionId?: string) =>
  queryOptions({
    queryKey: songQueryKeys.versionList(songId, viewerId, shownVersionId),
    queryFn: async ({ client: cache, queryKey }) => {
      try {
        return await makeApiRequest(() =>
          client.api.songs.versions[":songId"].$get({ param: { songId }, query: { shownVersionId } }),
        );
      } catch (error) {
        // Retain successful persisted history when a refresh fails offline.
        const cached = cache.getQueryData<SongVersionSummaryApi[]>(queryKey);
        if (!getIsOnline() && cached) return cached;
        throw error;
      }
    },
    staleTime: 60_000,
  });

/** Same lookup for offline navigation and the version table's availability. */
export function getCachedSongVersion(
  cache: QueryClient,
  songId: string,
  versionId: string,
  songs: readonly (SongData | SongDataApi)[] = [],
): SongData | SongDataApi | undefined {
  const exactState = cache.getQueryState(singleSongQueryOptions(songId, versionId).queryKey);
  // A confirmed removal/denial must not be resurrected by cache-first viewing.
  if (unavailableSheet(exactState?.error)) return undefined;
  const catalog = cache.getQueryData<SongDataApi[]>(songQueryKeys.catalog);
  const candidates = [exactState?.data as SongDataApi | undefined, ...songs,
    catalog?.find(song => song.id === songId && song.versionId === versionId)];
  let newest: SongData | SongDataApi | undefined;
  for (const sheet of candidates) {
    if (sheet?.id === songId && sheet.versionId === versionId &&
      (!newest || (sheet.versionRevision ?? 0) > (newest.versionRevision ?? 0))) newest = sheet;
  }
  return newest;
}

export const findOrFetchSong = async (
  songs: SongData[] | SongDataApi[],
  songId: string,
  versionId: string | undefined,
  queryClient: QueryClient,
): Promise<SongData> => {
  // Offline sheets open immediately. Online navigation resolves the current
  // sheet before returning a loader snapshot, including its concurrency token.
  if (!getIsOnline()) {
    const cached = versionId
      ? getCachedSongVersion(queryClient, songId, versionId, songs)
      : songs.find((song) => song.id === songId);
    if (cached) return cached instanceof SongData ? cached : new SongData(cached);
  }
  const raw = await queryClient.fetchQuery({
    ...singleSongQueryOptions(songId, versionId),
    staleTime: 0,
    // A cache miss must fail promptly offline instead of pausing navigation.
    networkMode: "always",
    retry: false,
  });
  if (raw.publishedVersionIds) {
    // A fresh sheet also carries fresh song-wide choices. Keep the badge's
    // catalog observation current without postponing the next catalog sync.
    const catalogUpdatedAt = queryClient.getQueryState(songQueryKeys.catalog)?.dataUpdatedAt;
    queryClient.setQueryData<SongDataApi[]>(songQueryKeys.catalog, (catalog) =>
      catalog?.map((song) => song.id === songId ? { ...song, publishedVersionIds: raw.publishedVersionIds } : song),
    { updatedAt: catalogUpdatedAt });
  }
  return new SongData(raw);
};

export const fetchPublicSongbooks = async (): Promise<Songbook[]> => {
  const response = await makeApiRequest(client.api.songs.songbooks.$get);
  return response.map(
    (s) => ({ ...s, songIds: new Set(s.songIds) }) as Songbook,
  );
};

export const fetchFeed = async (
  masterNickname: string,
): Promise<SessionSyncState | undefined> => {
  const response = await client.api.session[":masterNickname"].$get({
    param: { masterNickname },
    query: {},
  });
  let liveState: SessionSyncState | undefined;
  if (response.ok) liveState = (await response.json()) as SessionSyncState;
  return liveState;
};

// Returns the raw API rows so callers can cache plain data; building SongData
// instances is left to a `select` (a persisted class instance would rehydrate
// as a method-less plain object).
export const fetchExternalSearch = async (
  query: string,
): Promise<ExternalSearchResult[]> => {
  return await makeApiRequest(() =>
    client.api.songs.external.search.$get({ query: { q: query } }),
  );
};

// --- Admin API ---
export const getSongsAdmin = async (
  adminApi: AdminApi,
): Promise<SongDataDB[]> => {
  const response = await makeApiRequest(adminApi.songs.$get);
  return response.map(parseDBDates);
};

export const getVersionsAdmin = async (
  adminApi: AdminApi,
): Promise<SongVersionAdminApi[]> => {
  const response = await makeApiRequest(adminApi.songs.versions.$get);
  return response.map(parseDBDates) as SongVersionAdminApi[];
};

export const patchSongAdmin = async (
  adminApi: AdminApi,
  songId: string,
  songData: SongModificationSchema,
): Promise<SongDataDB> => {
  const modifiedSong = await makeApiRequest(() =>
    adminApi.songs[":songId"].$patch({
      param: { songId },
      json: songData,
    }),
  );
  return parseDBDates(modifiedSong);
};

export const deleteSongAdmin = async (
  adminApi: AdminApi,
  songId: string,
): Promise<SongDataDB> => {
  const deletedSong = await makeApiRequest(() =>
    adminApi.songs[":id"].$delete({
      param: { id: songId },
    }),
  );
  return parseDBDates(deletedSong);
};

export const songsWithCurrentVersionAdmin = async (
  adminApi: AdminApi,
): Promise<SongDataAdminApi[]> => {
  const songs = await makeApiRequest(adminApi.songs.withCurrentVersion.$get);
  return songs.map(parseDBDates) as SongDataAdminApi[];
};

export const patchVersionAdmin = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string,
  versionData: ModifySongVersionSchema,
): Promise<SongVersionApi> => {
  const updatedVersion = await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].$patch({
      param: { songId, versionId },
      json: { ...versionData },
    }),
  );
  return parseDBDates(updatedVersion);
};

export const deleteVersionAdmin = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string,
  expectedRevision: number,
): Promise<SongVersionApi> => {
  const deletedVersion = await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].$delete({
      param: { songId, versionId }, json: { expectedRevision },
    }),
  );
  return parseDBDates(deletedVersion);
};

export const resetVersionDB = async (adminApi: AdminApi) => {
  return await makeApiRequest(adminApi.songs["reset-songDB-version"].$post);
};

// --- Utility functions ---
export const buildSongDB = (
  songs: SongDataApi[],
  songbooks: Songbook[],
  userData: UserData,
): SongDB => {
  // Map of canonical songs for easy lookup/modification. Overlaid below with the
  // current user's pinned drafts where applicable.
  const songMap = new Map<string, SongDataApi>(
    songs.map((s) => [s.id, { ...s }]),
  );

  // Inject each songbook entry's server-resolved pinned draft (the user's own
  // pending edit, or a foreign draft they pinned — neither is in the global
  // list). `entry.song` is the one source for pinned drafts; canonical entries
  // leave the list song as-is. The saved key/capo is read live from the
  // favorites cache in useSongTranspose, not baked onto the song here.
  if (userData?.songbookEntries) {
    for (const entry of userData.songbookEntries.values()) {
      const sheet = songbookSheet(songMap.get(entry.songId), entry);
      if (sheet) songMap.set(entry.songId, sheet);
    }
  }

  // enrich with favorites and instantiate
  const songDatas = Array.from(songMap.values())
    .map((d) => ({
      ...d,
      isFavoriteByCurrentUser: userData?.favoriteIds.has(d.id),
    }))
    .map((enriched) => new SongData(enriched));

  // add personal favorites songbook if not public
  if (
    userData &&
    userData.favoriteIds &&
    !songbooks.map((s) => s.user).includes(userData.profile.id)
  ) {
    const user = userData.profile;
    songbooks = [
      ...songbooks,
      {
        user: user.id,
        image: user.image ?? "",
        name: user.nickname ?? "Yours",
        nickname: user.nickname,
        songIds: userData.favoriteIds,
      },
    ];
  }

  const languages: LanguageCount = songDatas.reduce((acc: LanguageCount, s) => {
    // map languages without paired flags to "other"
    const validLang: SongLanguage | undefined = isValidSongLanguage(s.language)
      ? s.language
      : "other";
    if (validLang) acc[validLang] = (acc[validLang] || 0) + 1;
    return acc;
  }, {} as LanguageCount);

  const songRanges = songDatas
    .map((s) => s.range?.semitones)
    .filter(Boolean) as number[];

  return {
    maxRange: songRanges.length > 0 ? Math.max(...songRanges) : undefined,
    languages,
    songs: songDatas,
    songbooks: songbooks.filter((s) => s.songIds.size > 0),
  };
};
