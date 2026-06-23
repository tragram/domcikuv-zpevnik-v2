import { SongDataDB } from "src/lib/db/schema";
import { queryClient } from "src/lib/query-client";
import {
  ModifySongVersionSchema,
  SongModificationSchema,
} from "src/worker/api/admin/songs";
import {
  SongDataAdminApi,
  SongDataApi,
  SongVersionAdminApi,
  SongVersionApi,
} from "src/worker/api/api-types";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import client, { AdminApi, API } from "~/../worker/api-client";
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
export const fetchSongs = async (api: API): Promise<SongDataApi[]> => {
  // 1. Get current cached state from TanStack/IndexedDB
  const cached = queryClient.getQueryData<SongDataApi[]>(["songs"]);
  const meta = queryClient.getQueryData<{
    version: string;
    lastUpdate: string;
  }>(["songs-meta"]);

  // 2. If no cache exists, do a full fetch
  if (!cached || !meta) {
    const data = await makeApiRequest(api.songs.$get);

    // Save metadata for next time
    queryClient.setQueryData(["songs-meta"], {
      version: data.songDBVersion,
      lastUpdate: data.lastUpdateAt,
    });

    return data.songs;
  }

  // 3. Try Incremental Update
  try {
    const data = await makeApiRequest(() =>
      api.songs.incremental.$get({
        query: { songDBVersion: meta.version, lastUpdateAt: meta.lastUpdate },
      }),
    );
    // 4. Handle Full Reset (isIncremental: false)
    if (!data.isIncremental) {
      queryClient.setQueryData(["songs-meta"], {
        version: data.songDBVersion,
        lastUpdate: data.lastUpdateAt,
      });
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

      const updatedList = Array.from(songMap.values());

      // Update metadata for next fetch
      queryClient.setQueryData(["songs-meta"], {
        version: data.songDBVersion,
        lastUpdate: data.lastUpdateAt,
      });

      return updatedList;
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
    queryKey: versionId ? ["song", "fetch", songId, versionId] : ["song", "fetch", songId],
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

export const findOrFetchSong = async (
  songs: SongData[] | SongDataApi[],
  songId: string,
  versionId: string | undefined,
  queryClient: QueryClient,
): Promise<SongData> => {
  // A specific version is never the canonical list entry — always fetch it.
  if (versionId) {
    const raw = await queryClient.fetchQuery(
      singleSongQueryOptions(songId, versionId),
    );
    return new SongData(raw);
  }
  // Otherwise prefer the already-loaded canonical song, fetching only on a miss.
  const local = songs.find((s) => s.id === songId);
  if (local) return local instanceof SongData ? local : new SongData(local);
  const raw = await queryClient.fetchQuery(
    singleSongQueryOptions(songId, undefined),
  );
  return new SongData(raw);
};

export const fetchPublicSongbooks = async (api: API): Promise<Songbook[]> => {
  const response = await makeApiRequest(api.songs.songbooks.$get);
  return response.map(
    (s) => ({ ...s, songIds: new Set(s.songIds) }) as Songbook,
  );
};

export const fetchFeed = async (
  api: API,
  masterNickname: string,
): Promise<SessionSyncState | undefined> => {
  const response = await api.session[":masterNickname"].$get({
    param: { masterNickname },
    query: {},
  });
  let liveState: SessionSyncState | undefined;
  if (response.ok) liveState = (await response.json()) as SessionSyncState;
  return liveState;
};

export const fetchExternalSearch = async (
  api: API,
  query: string,
): Promise<SongData[]> => {
  const response = await makeApiRequest(() =>
    api.songs.external.search.$get({ query: { q: query } }),
  );
  return response.map(SongData.fromExternalSearch);
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

export const approveSongVersion = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string,
) => {
  return await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].approve.$post({
      param: { songId, versionId },
    }),
  );
};

export const rejectSongVersion = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string,
) => {
  return await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].reject.$post({
      param: { songId, versionId },
    }),
  );
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
): Promise<SongVersionApi> => {
  const deletedVersion = await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].$delete({
      param: { songId, versionId },
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
      if (entry.song) songMap.set(entry.songId, { ...entry.song });
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
