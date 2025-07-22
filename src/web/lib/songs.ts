import { SongData } from "~/types/songData";
import { LanguageCount, SongDB } from "~/types/types";
import yaml from "js-yaml";
import { fileURL } from "./utils";
import { guessKey } from "~/features/SongView/utils/songRendering";
import client from "~/../worker/api-client";
import { handleApiResponse, makeApiRequest } from "./apiHelpers";

export type AdminApi = typeof client.api.admin;

/**
 * Fetches the complete song database with language statistics and range data
 * @returns Promise containing songs, language counts, and max vocal range
 * @throws {ApiError} When the songDB cannot be fetched or parsed
 */
export const fetchSongDB = async (): Promise<SongDB> => {
  const songDBData = await makeApiRequest<any[]>(
    () => fetch(fileURL("/songDB.json")),
    "Failed to fetch songDB"
  );
  const songs = songDBData.map((d) => new SongData(d));

  const languages: LanguageCount = songs
    .map((s) => s.language)
    .reduce((acc: Record<string, number>, lang: string) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

  const songRanges = songs.map((s) => s.range?.semitones).filter(Boolean);
  const songDB = {
    maxRange: Math.max(...songRanges),
    languages,
    songs,
  };
  return songDB;
};

/**
 * Fetches the song database using admin API
 * @param adminApi - The admin API client
 * @returns Promise containing songs, language counts, and max vocal range
 * @throws {ApiError} When the songDB cannot be fetched or parsed
 */
export const fetchSongDBAdmin = async (adminApi: AdminApi): Promise<SongDB> => {
  const response = await adminApi.songDB.$get();
  await handleApiResponse(response);
  const songDBData = await response.json();
  const songs = songDBData.songs.map((d) => new SongData(d));

  const languages: LanguageCount = songs
    .map((s) => s.language)
    .reduce((acc: Record<string, number>, lang: string) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

  const songRanges = songs.map((s) => s.range?.semitones).filter(Boolean);
  const songDB = {
    maxRange: Math.max(...songRanges),
    languages,
    songs,
  };
  return songDB;
};

/**
 * Fetches the illustration prompt for a specific song
 * @param songId - The ID of the song
 * @returns Promise containing the prompt response
 * @throws {ApiError} When the prompt cannot be loaded
 */
export const fetchIllustrationPrompt = async (songId: string): Promise<any> => {
  const response = await fetch(SongData.promptURL(songId));
  await handleApiResponse(response);
  const promptContent = await response.text();
  // TODO: this probably is not always the correct prompt...
  return yaml.load(promptContent)[0].response;
};

/**
 * Fetches song data including chordpro content and available illustrations
 * @param songId - The ID of the song to fetch
 * @param songDB - The complete song database for illustration lookup
 * @returns Promise containing the parsed song data
 * @throws {ApiError} When song data cannot be fetched
 */
export const fetchSong = async (songId: string, songDB: SongDB): Promise<SongData> => {
  const response = await fetch(SongData.chordproURL(songId));
  await handleApiResponse(response);
  const songRawData = await response.text();

  // TODO: this should be preparsed...
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
 * @throws {ApiError} When changes cannot be fetched
 */
export const fetchChangesAdmin = async (adminApi: AdminApi): Promise<any> => {
  const response = await adminApi.changes.$get();
  await handleApiResponse(response);
  return response.json();
};

/**
 * Verifies or rejects a pending change
 * @param adminApi - The admin API client
 * @param id - The change ID to verify
 * @param verified - Whether to verify (true) or reject (false) the change
 * @returns Promise containing the verification result
 * @throws {ApiError} When verification fails
 */
export const verifyChange = async (
  adminApi: AdminApi, 
  id: string, 
  verified: boolean
): Promise<any> => {
  const response = await adminApi.change.verify.$post({
    json: { id, verified }
  });
  await handleApiResponse(response);
  return response.json();
};

/**
 * Fetches all illustrations with song information
 * @param adminApi - The admin API client
 * @returns Promise containing the list of illustrations
 * @throws {ApiError} When illustrations cannot be fetched
 */
export const fetchIllustrationsAdmin = async (adminApi: AdminApi): Promise<any> => {
  const response = await adminApi.illustrations.$get();
  await handleApiResponse(response);
  return response.json();
};

/**
 * Creates a new illustration
 * @param adminApi - The admin API client
 * @param illustrationData - The illustration data to create
 * @returns Promise containing the creation result
 * @throws {ApiError} When illustration creation fails
 */
export const createIllustration = async (
  adminApi: AdminApi, 
  illustrationData: any
): Promise<any> => {
  const response = await adminApi.illustration.create.$post({
    json: illustrationData
  });
  await handleApiResponse(response);
  return response.json();
};

/**
 * Updates an existing illustration
 * @param adminApi - The admin API client
 * @param illustrationData - The illustration data to update (must include id)
 * @returns Promise containing the update result
 * @throws {ApiError} When illustration update fails
 */
export const updateIllustration = async (
  adminApi: AdminApi, 
  illustrationData: any
): Promise<any> => {
  const response = await adminApi.illustration.modify.$post({
    json: illustrationData
  });
  await handleApiResponse(response);
  return response.json();
};

/**
 * Deletes an illustration
 * @param adminApi - The admin API client
 * @param id - The ID of the illustration to delete
 * @returns Promise containing the deletion result
 * @throws {ApiError} When illustration deletion fails
 */
export const deleteIllustration = async (
  adminApi: AdminApi, 
  id: string
): Promise<any> => {
  const response = await adminApi.illustration[":id"].$delete({
    param: { id }
  });
  await handleApiResponse(response);
  return response.json();
};