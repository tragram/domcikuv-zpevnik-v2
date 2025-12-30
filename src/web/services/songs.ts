import { SongDataDB, SongVersionDB } from "src/lib/db/schema";
import {
  SongDataApi,
  SongWithCurrentVersion,
} from "src/worker/services/song-service";
import client, { API } from "~/../worker/api-client";
import { SongData } from "~/types/songData";
import {
  isValidSongLanguage,
  LanguageCount,
  SongDB,
  SongLanguage,
} from "~/types/types";
import { makeApiRequest } from "./apiHelpers";
import {
  ModifySongVersionSchema,
  SongModificationSchema,
} from "src/worker/api/admin/songs";
export * from "./illustrations";

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

// Public API
export const fetchSongs = async (
  api: API
): Promise<SongDataApi[]> => {
  const response = await makeApiRequest(api.songs.$get);
  return response.songs;
};

export const fetchPublicSongbooks = async (
  api: API
): Promise<Songbook[]> => {
  const response = await makeApiRequest(api.songs.songbooks.$get);
  return response.map((s) => {
    const newS = { ...s, songIds: new Set(s.songIds) } as Songbook;
    return newS;
  });
};

// Admin API
export const getSongsAdmin = async (
  adminApi: AdminApi
): Promise<SongDataDB[]> => {
  const response = await makeApiRequest(adminApi.songs.$get);
  return response.songs.map(parseDBDates);
};

export const getVersionsAdmin = async (
  adminApi: AdminApi
): Promise<SongVersionDB[]> => {
  const response = await makeApiRequest(adminApi.songs.versions.$get);
  return response.versions.map(parseDBDates);
};
export const putSongAdmin = async (
  adminApi: AdminApi,
  songId: string,
  songData: SongModificationSchema
): Promise<SongDataDB> => {
  const modifiedSong = await makeApiRequest(() =>
    adminApi.songs[":id"].$put({
      param: { id: songId },
      json: songData,
    })
  );
  return parseDBDates(modifiedSong);
};

export const setCurrentVersionAdmin = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string
): Promise<SongDataDB> => {
  const modifiedSong = await makeApiRequest(() =>
    adminApi.songs[":songId"]["current-version"][":versionId"].$put({
      param: { songId, versionId },
    })
  );
  return parseDBDates(modifiedSong);
};

export const deleteSongAdmin = async (
  adminApi: AdminApi,
  songId: string
): Promise<SongDataDB> => {
  const deletedSong = await makeApiRequest(() =>
    adminApi.songs[":id"].$delete({
      param: { id: songId },
    })
  );
  return parseDBDates(deletedSong);
};

export const songsWithCurrentVersionAdmin = async (
  adminApi: AdminApi
): Promise<SongWithCurrentVersion[]> => {
  const songs = await makeApiRequest(adminApi.songs.withCurrentVersion.$get);
  return songs.songs.map(parseDBDates);
};

export const putVersionAdmin = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string,
  versionData: ModifySongVersionSchema
): Promise<SongVersionDB> => {
  const updatedVersion = await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].$put({
      param: { songId, versionId },
      json: { ...versionData },
    })
  );
  return parseDBDates(updatedVersion);
};

export const deleteVersionAdmin = async (
  adminApi: AdminApi,
  songId: string,
  versionId: string
): Promise<SongVersionDB> => {
  const deletedVersion = await makeApiRequest(() =>
    adminApi.songs[":songId"].versions[":versionId"].$delete({
      param: { songId, versionId },
    })
  );
  return parseDBDates(deletedVersion);
};

export const resetVersionDB = async (adminApi: AdminApi) => {
  const newVersion = await makeApiRequest(
    adminApi.songs["reset-songDB-version"].$post
  );
  return newVersion;
};

// Utility functions
export const buildSongDB = (
  songs: SongDataApi[],
  songbooks: Songbook[]
): SongDB => {
  const songDatas = songs.map((d) => new SongData(d));
  const languages: LanguageCount = songDatas
    .map((s) => s.language)
    .reduce((acc: LanguageCount, lang: string) => {
      const validLang: SongLanguage = isValidSongLanguage(lang)
        ? lang
        : "other";
      acc[validLang] = (acc[validLang] || 0) + 1;
      return acc;
    }, {} as LanguageCount);

  const songRanges = songDatas
    .map((s) => s.range?.semitones)
    .filter(Boolean) as Array<number>;

  return {
    maxRange: songRanges.length > 0 ? Math.max(...songRanges) : undefined,
    languages,
    songs: songDatas,
    songbooks: songbooks.filter((s) => s.songIds.size > 0),
  };
};
