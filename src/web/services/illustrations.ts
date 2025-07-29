import yaml from "js-yaml";
import {
    IllustrationPromptDB,
    SongDataDB,
    SongIllustrationDB
} from "src/lib/db/schema";
import { IllustrationPromptCreateSchema } from "src/worker/api/admin/illustration-prompts";
import {
    adminIllustrationResponse,
    IllustrationCreateSchema,
    IllustrationModifySchema,
} from "src/worker/api/admin/illustrations";
import { SongData } from "~/types/songData";
import { ApiException, makeApiRequest } from "./apiHelpers";
import { AdminApi, parseDBDates } from "./songs";
/**
 * Fetches the illustration prompt for a specific song (legacy method)
 * @param songId - The ID of the song
 * @returns Promise containing the prompt response
 * @throws {ApiException} When the prompt cannot be loaded or parsed
 */
export const fetchIllustrationPrompt = async (
  song: SongData
): Promise<string> => {
  if (!song.currentIllustration) {
    throw Error("Illustration missing --> no prompt available.");
  }
  const response = await fetch(song.currentIllustration?.promptURL);
  const promptContent = await response.text();
  return yaml.load(promptContent)[0].response;
};

/**
 * Fetches all illustrations with song information and prompt data
 * @param adminApi - The admin API client
 * @returns Promise containing the list of illustrations with prompts
 * @throws {ApiException} When illustrations cannot be fetched
 */
export const fetchIllustrationsAdmin = async (
  adminApi: AdminApi
): Promise<SongIllustrationDB[]> => {
  const songWithIllustrationsAndPrompts = await makeApiRequest(
    adminApi.illustrations.$get
  );
  return songWithIllustrationsAndPrompts.map(parseDBDates);
};

/**
 * Fetches all prompts with song information and prompt data
 * @param adminApi - The admin API client
 * @returns Promise containing the list of illustrations with prompts
 * @throws {ApiException} When illustrations cannot be fetched
 */
export const fetchPromptsAdmin = async (
  adminApi: AdminApi
): Promise<IllustrationPromptDB[]> => {
  const prompts = await makeApiRequest(adminApi.illustrations.prompts.$get);
  return prompts;
};

/**
 * Creates a new illustration prompt
 * @param adminApi - The admin API client
 * @param promptData - The prompt data to create
 * @returns Promise containing the creation result
 * @throws {ApiException} When prompt creation fails
 */
export const createIllustrationPrompt = async (
  adminApi: AdminApi,
  promptData: IllustrationPromptCreateSchema
): Promise<IllustrationPromptDB> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.prompts.create.$post({ json: promptData })
  );
  return response;
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
): Promise<adminIllustrationResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.create.$post({ json: illustrationData })
  );
  response.illustration = parseDBDates(response.illustration);
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
): Promise<adminIllustrationResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.modify.$post({ json: illustrationData })
  );
  response.illustration = parseDBDates(response.illustration);
  return response;
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
): Promise<null> => {
  const response = await makeApiRequest(() =>
    adminApi.illustration[":id"].$delete({ param: { id } })
  );
  return response;
};

/**
 * Deletes an illustration prompt
 * @param adminApi - The admin API client
 * @param id - The ID of the prompt to delete
 * @returns Promise containing the deletion result
 * @throws {ApiException} When prompt deletion fails
 */
export const deleteIllustrationPrompt = async (
  adminApi: AdminApi,
  id: string
): Promise<null> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.prompts[":id"].$delete({ param: { id } })
  );
  return response;
};

/**
 * Fetches illustrations for a specific song
 * @param adminApi - The admin API client
 * @param songId - The ID of the song
 * @returns Promise containing song-specific illustrations
 * @throws {ApiException} When illustrations cannot be fetched
 */
export const fetchSongIllustrations = async (
  adminApi: AdminApi,
  songId: string
): Promise<SongWithIllustrationsAndPrompts[]> => {
  const allIllustrations = await fetchIllustrationsAdmin(adminApi);
  return allIllustrations.filter(
    (illustration) => illustration.songId === songId
  );
};

/**
 * Sets an illustration as active (deactivates others for the same song)
 * @param adminApi - The admin API client
 * @param illustrationId - The ID of the illustration to activate
 * @returns Promise containing the updated illustration
 * @throws {ApiException} When activation fails
 */
export const setActiveIllustration = async (
  adminApi: AdminApi,
  illustrationId: string
): Promise<SongWithIllustrationsAndPrompts> => {
  return updateIllustration(adminApi, {
    id: illustrationId,
    isActive: true,
  });
};

export type SongWithIllustrationsAndPrompts = {
  song: {
    id: string;
    title: string;
    artist: string;
  };
  illustrations: SongIllustrationDB[];
  prompts: Record<string, IllustrationPromptDB>;
};

export const songsWithIllustrationsAndPrompts = (
  songs: SongDataDB[],
  illustrations: SongIllustrationDB[],
  prompts: IllustrationPromptDB[]
) => {
  const songIllustrationsPrompts = songs.reduce((acc, s) => {
    acc[s.id] = {
      song: {
        id: s.id,
        title: s.title,
        artist: s.artist,
      },
      illustrations: [],
      prompts: {},
    } as SongWithIllustrationsAndPrompts;

    return acc;
  }, {} as Record<string, SongWithIllustrationsAndPrompts>);

  illustrations.forEach((il) => {
    songIllustrationsPrompts[il.songId].illustrations.push(il);
  });

  prompts.forEach((prompt) => {
    songIllustrationsPrompts[prompt.songId].prompts[prompt.id] = prompt;
  });
  return songIllustrationsPrompts;
};
