import {
  IllustrationPromptDB,
  SongDataDB,
  SongIllustrationDB,
} from "src/lib/db/schema";
import client, { API } from "src/worker/api-client";
import {
  adminIllustrationResponse,
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
  IllustrationModifySchema,
  IllustrationPromptCreateSchema,
} from "src/worker/helpers/illustration-helpers";
import { SongWithCurrentVersion } from "src/worker/helpers/song-helpers";
import { SongData } from "~/types/songData";
import { makeApiRequest } from "./api-service";
import { AdminApi, parseDBDates } from "./song-service";

export type SongDBApi = typeof client.api.songs;

export const fetchIllustrationPrompt = async (
  songDBApi: SongDBApi,
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
): Promise<SongIllustrationDB[]> => {
  const songWithIllustrationsAndPrompts = await makeApiRequest(
    adminApi.illustrations.$get,
  );
  return songWithIllustrationsAndPrompts.map(parseDBDates);
};

export const fetchPromptsAdmin = async (
  adminApi: AdminApi,
): Promise<IllustrationPromptDB[]> => {
  const prompts = await makeApiRequest(adminApi.prompts.$get);
  return prompts.map(parseDBDates);
};

export const createIllustrationPrompt = async (
  adminApi: AdminApi,
  promptData: IllustrationPromptCreateSchema,
): Promise<IllustrationPromptDB> => {
  const response = await makeApiRequest(() =>
    adminApi.prompts.create.$post({ json: promptData }),
  );
  return parseDBDates(response);
};

export const generateIllustration = async (
  adminApi: AdminApi | API,
  illustrationData: IllustrationGenerateSchema,
): Promise<adminIllustrationResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.generate.$post({ json: illustrationData }),
  );
  return {
    illustration: parseDBDates(response.illustration),
    song: parseDBDates(response.song),
    prompt: parseDBDates(response.prompt),
  };
};

function buildIllustrationFormData(data: any): FormData {
  const formData = new FormData();

  if (data.songId) formData.append("songId", data.songId);
  if (data.imageModel) formData.append("imageModel", data.imageModel);
  if (data.setAsActive !== undefined)
    formData.append("setAsActive", String(data.setAsActive));

  if (data.promptId) formData.append("promptId", data.promptId);
  if (data.promptText) formData.append("promptText", data.promptText);
  if (data.summaryModel) formData.append("summaryModel", data.summaryModel);
  if (data.summaryPromptVersion)
    formData.append("summaryPromptVersion", data.summaryPromptVersion);

  if (data.imageFile instanceof File) {
    formData.append("imageFile", data.imageFile);
  }

  return formData;
}

export const createIllustration = async (
  adminApi: AdminApi,
  data: IllustrationCreateSchema,
): Promise<adminIllustrationResponse> => {
  const formData = buildIllustrationFormData(data);

  const response = await makeApiRequest(() =>
    adminApi.illustrations.create.$post({
      form: Object.fromEntries(formData.entries()),
    } as any),
  );

  return {
    illustration: parseDBDates(response.illustration),
    song: parseDBDates(response.song),
    prompt: parseDBDates(response.prompt),
  };
};

export const updateIllustration = async (
  adminApi: AdminApi,
  illustrationId: string,
  illustrationData: IllustrationModifySchema,
): Promise<adminIllustrationResponse> => {
  // 1. If we have a file, we MUST send as FormData
  if (illustrationData.imageFile) {
    const formData = buildIllustrationFormData(illustrationData);
    const response = await makeApiRequest(() =>
      adminApi.illustrations[":id"].$put({
        param: { id: illustrationId },
        form: Object.fromEntries(formData.entries()),
      } as any),
    );
    return {
      illustration: parseDBDates(response.illustration),
      song: parseDBDates(response.song),
      prompt: parseDBDates(response.prompt),
    };
  }

  const response = await makeApiRequest(() =>
    adminApi.illustrations[":id"].$put({
      param: { id: illustrationId },
      json: illustrationData as any, 
    }),
  );

  return {
    illustration: parseDBDates(response.illustration),
    song: parseDBDates(response.song),
    prompt: parseDBDates(response.prompt),
  };
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

export const setActiveIllustration = async (
  adminApi: AdminApi,
  songId: string,
  illustrationId: string,
): Promise<SongDataDB> => {
  const response = await makeApiRequest(() =>
    adminApi.songs[":songId"]["current-illustration"][":illustrationId"].$put({
      param: {
        songId: songId,
        illustrationId: illustrationId,
      },
    }),
  );
  return parseDBDates(response);
};

export type SongWithIllustrationsAndPrompts = {
  song: SongWithCurrentVersion;
  illustrations: SongIllustrationDB[];
  prompts: Record<string, IllustrationPromptDB>;
};

export const songsWithIllustrationsAndPrompts = (
  songs: SongWithCurrentVersion[],
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