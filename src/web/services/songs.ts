import { SongData } from "~/types/songData";
import { LanguageCount, SongDB } from "~/types/types";
import yaml from "js-yaml";
import { fileURL } from "../lib/utils";
import { guessKey } from "~/features/SongView/utils/songRendering";
import client from "~/../worker/api-client";
import { handleApiResponse, makeApiRequest, ApiException } from "./apiHelpers";
import {
  SongChangeDB,
  SongDataDB,
  SongIllustrationDB,
} from "src/lib/db/schema";
import {
  IllustrationApiResponse,
  IllustrationCreateSchema,
  IllustrationModifySchema,
} from "src/worker/api/admin/illustrations";

export type AdminApi = typeof client.api.admin;

interface Timestamped {
  createdAt: Date | string;
  updatedAt: Date | string;
}

type WithTimestamps<T> = T & Timestamped;

const parseDBDates = <T>(o: WithTimestamps<T>) => {
  return {
    ...o,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
  };
};

/**
 * Fetches the complete song database with language statistics and range data
 * @returns Promise containing songs, language counts, and max vocal range
 * @throws {ApiException} When the songDB cannot be fetched or parsed
 */
export const fetchSongDB = async (): Promise<SongDB> => {
  const songDBData = await (await fetch(fileURL("/songDB.json"))).json();
  const songs = songDBData.map((d) => new SongData(d));

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
 * Fetches the illustration prompt for a specific song
 * @param songId - The ID of the song
 * @returns Promise containing the prompt response
 * @throws {ApiException} When the prompt cannot be loaded or parsed
 */
export const fetchIllustrationPrompt = async (songId: string): Promise<any> => {
  const response = await fetch(SongData.promptURL(songId));
  await handleApiResponse(response); // validate JSend
  const promptContent = await response.text();
  return yaml.load(promptContent)[0].response;
};

/**
 * Fetches song data including chordpro content and available illustrations
 * @param songId - The ID of the song to fetch
 * @param songDB - The complete song database for illustration lookup
 * @returns Promise containing the parsed song data
 * @throws {ApiException} When song data cannot be fetched
 */
export const fetchSong = async (
  songId: string,
  songDB: SongDB
): Promise<SongData> => {
  const response = await fetch(SongData.chordproURL(songId));
  const songRawData = await response.text();

  const songIdsAndIllustrations = songDB.songs.map((s) => ({
    id: SongData.id(s.title, s.artist),
    availableIllustrations: s.illustrationData.availableIllustrations,
  }));
  const availableIllustrations = songIdsAndIllustrations.find(
    (song) => song.id === songId
  )?.availableIllustrations;

  const songData = SongData.fromChordpro(songRawData, availableIllustrations);

  if (!songData.key) {
    songData.key = guessKey(songData.content || "");
  }

  return songData;
};

/**
 * Fetches all pending changes requiring admin review
 * @param adminApi - The admin API client
 * @returns Promise containing the list of changes
 * @throws {ApiException} When changes cannot be fetched
 */
export const fetchChangesAdmin = async (
  adminApi: AdminApi
): Promise<SongChangeDB[]> => {
  const response = await makeApiRequest(adminApi.changes.$get);
  return response.changes;
};

/**
 * Verifies or rejects a pending change
 * @param adminApi - The admin API client
 * @param id - The change ID to verify
 * @param verified - Whether to verify (true) or reject (false) the change
 * @returns Promise containing the verification result
 * @throws {ApiException} When verification fails
 */
export const verifyChange = async (
  adminApi: AdminApi,
  id: string,
  verified: boolean
): Promise<any> => {
  const response = await makeApiRequest(() =>
    adminApi.change.verify.$post({ json: { id, verified } })
  );
  return response;
};

/**
 * Fetches all illustrations with song information
 * @param adminApi - The admin API client
 * @returns Promise containing the list of illustrations
 * @throws {ApiException} When illustrations cannot be fetched
 */
export const fetchIllustrationsAdmin = async (
  adminApi: AdminApi
): Promise<IllustrationApiResponse[]> => {
  const illustrations = (
    await makeApiRequest(adminApi.illustrations.$get)
  ).illustrations.map(parseDBDates);
  return illustrations;
};

/**
 * Creates a new illustration
 * @param adminApi - The admin API client
 * @param illustrationData - The illustration data to create
 * @returns Promise containing the creation result
 * @throws {ApiException} When illustration creation fails
 */
export const createIllustration = async (
  adminApi: AdminApi,
  illustrationData: IllustrationCreateSchema
): Promise<IllustrationApiResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustration.create.$post({ json: illustrationData })
  );
  return parseDBDates(response);
};

/**
 * Updates an existing illustration
 * @param adminApi - The admin API client
 * @param illustrationData - The illustration data to update (must include id)
 * @returns Promise containing the update result
 * @throws {ApiException} When illustration update fails
 */
export const updateIllustration = async (
  adminApi: AdminApi,
  illustrationData: IllustrationModifySchema
): Promise<IllustrationApiResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustration.modify.$post({ json: illustrationData })
  );
  return parseDBDates(response);
};

/**
 * Deletes an illustration
 * @param adminApi - The admin API client
 * @param id - The ID of the illustration to delete
 * @returns Promise containing the deletion result
 * @throws {ApiException} When illustration deletion fails
 */
export const deleteIllustration = async (
  adminApi: AdminApi,
  id: string
): Promise<any> => {
  const response = await makeApiRequest(() =>
    adminApi.illustration[":id"].$delete({ param: { id } })
  );
  return response;
};
