import { IllustrationPromptDB, SongIllustrationDB } from "src/lib/db/schema";
import { AdminApi, SongsAPI } from "src/worker/api-client";
import {
  AdminIllustrationResponse,
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
  IllustrationModifySchema,
  IllustrationPromptApi,
  IllustrationPromptCreateSchema,
  SongDataAdminApi,
  SongDataApi,
  SongIllustrationApi,
} from "src/worker/api/api-types";
import { PopulatedSongDB } from "src/worker/helpers/song-helpers";
import { SongData } from "~/types/songData";
import { makeApiRequest } from "./api-service";
import { parseDBDates } from "./song-service";

export const fetchIllustrationPrompt = async (
  songDBApi: SongsAPI,
  song: SongData,
): Promise<string> => {
  const promptId = song.currentIllustration?.promptId;
  if (!promptId) {
    return "Could not fetch prompt - currentIllustration?.promptId is empty.";
  }
  const response = await makeApiRequest(() =>
    songDBApi.prompts[":id"].$get({
      param: { id: promptId },
    }),
  );
  return response.text;
};

// Admin API
export const fetchIllustrationsAdmin = async (
  adminApi: AdminApi,
): Promise<SongIllustrationApi[]> => {
  const songWithIllustrationsAndPrompts = await makeApiRequest(
    adminApi.illustrations.$get,
  );
  return songWithIllustrationsAndPrompts.map(parseDBDates);
};

export const fetchPromptsAdmin = async (
  adminApi: AdminApi,
): Promise<IllustrationPromptApi[]> => {
  const prompts = await makeApiRequest(adminApi.prompts.$get);
  return prompts.map(parseDBDates);
};

export const createIllustrationPrompt = async (
  adminApi: AdminApi,
  promptData: IllustrationPromptCreateSchema,
): Promise<IllustrationPromptApi> => {
  const response = await makeApiRequest(() =>
    adminApi.prompts.create.$post({ json: promptData }),
  );
  return parseDBDates(response);
};

export const generateIllustration = async (
  adminApi: AdminApi,
  illustrationData: IllustrationGenerateSchema,
): Promise<AdminIllustrationResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.generate.$post({ json: illustrationData }),
  );
  return {
    illustration: parseDBDates(response.illustration) as SongIllustrationDB,
    song: parseDBDates(response.song) as PopulatedSongDB,
    prompt: parseDBDates(response.prompt) as IllustrationPromptDB,
  };
};

export const createIllustration = async (
  adminApi: AdminApi,
  data: IllustrationCreateSchema,
): Promise<AdminIllustrationResponse> => {
  const formPayload = {
    ...data,
    setAsActive: String(data.setAsActive),
  };

  const response = await makeApiRequest(() =>
    adminApi.illustrations.create.$post({
      form: formPayload,
    }),
  );

  return {
    illustration: parseDBDates(response.illustration) as SongIllustrationDB,
    song: parseDBDates(response.song) as PopulatedSongDB,
    prompt: parseDBDates(response.prompt) as IllustrationPromptDB,
  };
};

export const updateIllustration = async (
  adminApi: AdminApi,
  illustrationId: string,
  illustrationData: IllustrationModifySchema,
): Promise<SongIllustrationDB> => {
  const formPayload = {
    ...illustrationData,
    setAsActive:
      illustrationData.setAsActive === undefined
        ? undefined
        : String(illustrationData.setAsActive),
  };

  const illustration = await makeApiRequest(() =>
    adminApi.illustrations[":id"].$put({
      param: { id: illustrationId },
      form: formPayload,
    }),
  );

  return parseDBDates(illustration);
};

export const deleteIllustration = async (
  adminApi: AdminApi,
  id: string,
): Promise<void> => {
  await makeApiRequest(() =>
    adminApi.illustrations[":id"].$delete({
      param: { id },
    }),
  );
};

export const restoreIllustration = async (
  adminApi: AdminApi,
  id: string,
): Promise<void> => {
  await makeApiRequest(() =>
    adminApi.illustrations[":id"].restore.$post({
      param: { id },
    }),
  );
};

export const deleteIllustrationPrompt = async (
  adminApi: AdminApi,
  id: string,
): Promise<void> => {
  await makeApiRequest(() =>
    adminApi.prompts[":id"].$delete({
      param: { id },
    }),
  );
};

export type SongWithIllustrationsAndPrompts = {
  song: SongDataAdminApi;
  illustrations: SongIllustrationDB[];
  prompts: Record<string, IllustrationPromptDB>;
};

export const songsWithIllustrationsAndPrompts = (
  songs: SongDataAdminApi[],
  illustrations: SongIllustrationDB[],
  prompts: IllustrationPromptDB[],
) => {
  const songIllustrationsPrompts = songs.reduce(
    (acc, s) => {
      acc[s.id] = {
        song: s,
        illustrations: [],
        prompts: {},
      } as SongWithIllustrationsAndPrompts;

      return acc;
    },
    {} as Record<string, SongWithIllustrationsAndPrompts>,
  );

  illustrations.forEach((il) => {
    if (Object.hasOwn(songIllustrationsPrompts, il.songId))
      songIllustrationsPrompts[il.songId].illustrations.push(il);
  });

  prompts.forEach((prompt) => {
    if (Object.hasOwn(songIllustrationsPrompts, prompt.songId))
      songIllustrationsPrompts[prompt.songId].prompts[prompt.id] = prompt;
  });

  return songIllustrationsPrompts;
};
