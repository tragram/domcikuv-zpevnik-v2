import {
  SongDataDB,
  SongVersionDB
} from "src/lib/db/schema";
import { SongDataApi } from "src/worker/api/songDB";
import client from "~/../worker/api-client";
import { SongData } from "~/types/songData";
import {
  ChordPro,
  isValidSongLanguage,
  LanguageCount,
  SongDB,
  SongLanguage,
} from "~/types/types";
import { ApiException, handleApiResponse, makeApiRequest } from "./apiHelpers";
export * from "./illustrations"

export type AdminApi = typeof client.api.admin;

interface Timestamped {
  createdAt: Date | string;
  updatedAt: Date | string;
}

type WithTimestamps<T> = T & Timestamped;

export interface Songbook {
  user: string;
  image: string;
  name: string;
  songIds: Set<string>;
}

export const parseDBDates = <T>(o: WithTimestamps<T>) => {
  return {
    ...o,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
  };
};

/**
 * Fetches the songs
 * @returns Promise containing songs, language counts, and max vocal range
 * @throws {ApiException} When the songDB cannot be fetched or parsed
 */
export const fetchSongs = async (
  api: typeof client.api
): Promise<SongDataApi[]> => {
  const response = await makeApiRequest(api.songs.$get);
  return response.songs;
};

export const fetchPublicSongbooks = async (
  api: typeof client.api
): Promise<Songbook[]> => {
  const response = await makeApiRequest(api.songs.songbooks.$get);
  return response.map((s) => {
    const newS = { ...s, songIds: new Set(s.songIds) } as Songbook;
    return newS;
  });
};

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

/**
 * Fetches the song database using admin API
 * @param adminApi - The admin API client
 * @returns Promise containing songs, language counts, and max vocal range
 * @throws {ApiException} When the songDB cannot be fetched or parsed
 */
export const fetchSongDBAdmin = async (adminApi: AdminApi): Promise<SongDB> => {
  const json = await handleApiResponse<SongDataDB>(await adminApi.songs.$get());
  const songs = json.songs.map((d) => new SongData(d));

  const languages: LanguageCount = songs
    .map((s) => s.language)
    .reduce((acc: Record<string, number>, lang: string) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

  const songRanges = songs.map((s) => s.range?.semitones).filter(Boolean);
  return {
    maxRange: Math.max(...songRanges),
    languages,
    songs,
  };
};

/**
 * Fetches song data including chordpro content and available illustrations
 * @param songId - The ID of the song to fetch
 * @param songDB - The complete song database for illustration lookup
 * @returns Promise containing the parsed song data
 * @throws {ApiException} When song data cannot be fetched
 */
export const fetchSongContent = async (
  songData: SongData
): Promise<ChordPro> => {
  const response = await fetch(songData.chordproURL);
  const songContent = await response.text();
  return songContent;
};

export const fetchSongFromId = async (
  songId: string,
  songDB: SongDB
): Promise<ChordPro> => {
  const songData = songDB.songs.find((s) => (s.id = songId));
  const songContent = await fetchSongContent(songData);
  return songContent;
};

/**
 * Fetches all pending versions requiring admin review
 * @param adminApi - The admin API client
 * @returns Promise containing the list of versions
 * @throws {ApiException} When versions cannot be fetched
 */
export const fetchVersionsAdmin = async (
  adminApi: AdminApi
): Promise<SongVersionDB[]> => {
  const response = await makeApiRequest(adminApi.versions.$get);
  return response.versions;
};

/**
 * Verifies or rejects a pending version
 * @param adminApi - The admin API client
 * @param id - The version ID to verify
 * @param verified - Whether to verify (true) or reject (false) the version
 * @returns Promise containing the verification result
 * @throws {ApiException} When verification fails
 */
export const verifyVersion = async (
  adminApi: AdminApi,
  id: string,
  verified: boolean
): Promise<any> => {
  const response = await makeApiRequest(() =>
    adminApi.version.verify.$post({ json: { id, verified } })
  );
  return response;
};
