import { SongDataDB, SongVersionDB } from "src/lib/db/schema";
import {
  SongDataApi,
  SongWithCurrentVersion,
} from "src/worker/helpers/song-helpers";
import client, { API } from "~/../worker/api-client";
import { SongData } from "~/types/songData";
import {
  isValidSongLanguage,
  LanguageCount,
  SongDB,
  SongLanguage,
} from "~/types/types";
import { makeApiRequest } from "./api-service";
import {
  ModifySongVersionSchema,
  SongModificationSchema,
} from "src/worker/api/admin/songs";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import { ExternalSong } from "src/worker/helpers/external-search";

export * from "./illustration-service";

export type AdminApi = typeof client.api.admin;

interface Timestamped {
  createdAt?: Date | string;
  updatedAt?: Date | string;
  approvedAt?: Date | string | null;
  lastLogin?: Date | string | null;
}

export interface Songbook {
  user: string;
  image: string;
  name: string;
  songIds: Set<string>;
}

export const parseDBDates = <T extends Timestamped>(o: T) => {
  return {
    ...o,
    createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
    updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
    approvedAt: o.approvedAt ? new Date(o.approvedAt) : null,
    lastLogin: o.lastLogin ? new Date(o.lastLogin) : null,
  };
};

// --- Public API ---
export const fetchSongs = async (api: API): Promise<SongDataApi[]> => {
  const response = await makeApiRequest(api.songs.$get);
  return response.songs;
};

export const fetchSongVersion = async (
  api: API,
  songId: string,
  versionId?: string,
): Promise<SongData> => {
  let songData: SongDataApi;
  if (versionId) {
    songData = await makeApiRequest(() =>
      api.songs.fetch[":songId"][":versionId"].$get({
        param: { songId, versionId },
      }),
    );
  } else {
    songData = await makeApiRequest(() =>
      api.songs.fetch[":id"].$get({
        param: { id: songId },
      }),
    );
  }
  return new SongData(songData);
};

export const findOrFetchSong = async (
  api: API,
  songDB: SongDB,
  songId: string,
  versionId?: string,
): Promise<SongData | null> => {
  let songData: SongData | undefined;
  if (versionId) {
    songData = new SongData(
      await makeApiRequest(() =>
        api.songs.fetch[":songId"][":versionId"].$get({
          param: { songId, versionId },
        }),
      ),
    );
  } else {
    songData = songDB.songs.find((s) => s.id === songId);
    if (!songData) {
      songData = new SongData(
        await makeApiRequest(() =>
          api.songs.fetch[":id"].$get({
            param: { id: songId },
          }),
        ),
      );
    }
  }
  return songData ?? null;
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
  });
  let liveState: SessionSyncState | undefined;
  if (response.ok) liveState = (await response.json()) as SessionSyncState;
  return liveState;
};

export const fetchExternalSearch = async (
  api: API,
  query: string,
): Promise<ExternalSong[]> => {
  // Call the new Hono backend route
  const response = await makeApiRequest(() =>
    api.songs.external.search.$get({ query: { q: query } }),
  );
  return response;
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
): Promise<SongVersionDB[]> => {
  const response = await makeApiRequest(adminApi.songs.versions.$get);
  return response.map(parseDBDates);
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
      // Using patch as per your songs.ts admin file
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
): Promise<SongWithCurrentVersion[]> => {
  const songs = await makeApiRequest(adminApi.songs.withCurrentVersion.$get);
  return songs.songs.map(parseDBDates);
};

export const patchVersionAdmin = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string,
  versionData: ModifySongVersionSchema,
): Promise<SongVersionDB> => {
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
): Promise<SongVersionDB> => {
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
  userFavoriteSongIds?: Set<string> | string[],
): SongDB => {
  const favoritesSet =
    userFavoriteSongIds instanceof Set
      ? userFavoriteSongIds
      : new Set(userFavoriteSongIds || []);

  const songDatas = songs
    .map((d) => ({
      ...d,
      isFavoriteByCurrentUser: favoritesSet.has(d.id),
    }))
    .map((enriched) => new SongData(enriched));

  const languages: LanguageCount = songDatas.reduce((acc: LanguageCount, s) => {
    const validLang: SongLanguage = isValidSongLanguage(s.language)
      ? s.language
      : "other";
    acc[validLang] = (acc[validLang] || 0) + 1;
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
