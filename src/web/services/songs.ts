import yaml from "js-yaml";
import {
  IllustrationPromptDB,
  SongDataDB,
  SongIllustrationDB,
  SongVersionDB,
} from "src/lib/db/schema";
import { IllustrationPromptCreateSchema } from "src/worker/api/admin/illustration-prompts";
import {
  adminIllustrationResponse,
  IllustrationCreateSchema,
  IllustrationModifySchema,
} from "src/worker/api/admin/illustrations";
import { SongDataApi } from "src/worker/api/songDB";
import client from "~/../worker/api-client";
import { guessKey } from "~/features/SongView/utils/songRendering";
import { SongData } from "~/types/songData";
import {
  ChordPro,
  isValidSongLanguage,
  LanguageCount,
  SongDB,
  SongLanguage,
} from "~/types/types";
import { ApiException, handleApiResponse, makeApiRequest } from "./apiHelpers";

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
