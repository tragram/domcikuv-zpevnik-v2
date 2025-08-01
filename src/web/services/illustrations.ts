import yaml from "js-yaml";
import {
  IllustrationPromptDB,
  SongDataDB,
  SongIllustrationDB,
} from "src/lib/db/schema";
import {
  adminIllustrationResponse,
  IllustrationCreateSchema,
  IllustrationGenerateSchema,
  IllustrationModifySchema,
  IllustrationPromptCreateSchema,
} from "src/worker/services/illustration-service";
import { SongData } from "~/types/songData";
import { makeApiRequest } from "./apiHelpers";
import { AdminApi, parseDBDates } from "./songs";
import { SongWithCurrentVersion } from "src/worker/services/song-service";

// Legacy
export const fetchIllustrationPrompt = async (
  song: SongData
): Promise<string> => {
  if (!song.currentIllustration) {
    throw Error("Illustration missing --> no prompt available.");
  }
  const response = await fetch(song.currentIllustration?.promptURL);
  const promptContent = await response.text();
  const data = yaml.load(promptContent) as [{ response: string }];
  if (!data?.[0]?.response) {
    throw new Error("Invalid prompt file format");
  }
  return data[0].response;
};

// Admin API
export const fetchIllustrationsAdmin = async (
  adminApi: AdminApi
): Promise<SongIllustrationDB[]> => {
  const songWithIllustrationsAndPrompts = await makeApiRequest(
    adminApi.illustrations.$get
  );
  return songWithIllustrationsAndPrompts.map(parseDBDates);
};

export const fetchPromptsAdmin = async (
  adminApi: AdminApi
): Promise<IllustrationPromptDB[]> => {
  const prompts = await makeApiRequest(adminApi.prompts.$get);
  return prompts.map(parseDBDates);
};

export const createIllustrationPrompt = async (
  adminApi: AdminApi,
  promptData: IllustrationPromptCreateSchema
): Promise<IllustrationPromptDB> => {
  const response = await makeApiRequest(() =>
    adminApi.prompts.create.$post({ json: promptData })
  );
  return parseDBDates(response);
};

export const createIllustration = async (
  adminApi: AdminApi,
  data: IllustrationCreateSchema
): Promise<adminIllustrationResponse> => {
  const formData = new FormData();
  formData.append("songId", data.songId);
  if (data.summaryPromptId && data.summaryPromptId.trim()) {
    formData.append("summaryPromptId", data.summaryPromptId.trim());
  }
  formData.append("imageModel", data.imageModel);
  formData.append("setAsActive", data.setAsActive.toString());
  // Add URLs if provided
  if (data.imageURL) {
    formData.append("imageURL", data.imageURL);
  }
  if (data.thumbnailURL) {
    formData.append("thumbnailURL", data.thumbnailURL);
  }

  // Add files if provided
  if (data.imageFile) {
    formData.append("imageFile", data.imageFile);
  }
  if (data.thumbnailFile) {
    formData.append("thumbnailFile", data.thumbnailFile);
  }
  // formData cannot be sent via Hono's RPC
  const response = await makeApiRequest(() =>
    adminApi.illustrations.create.$post({
      form: data as unknown as Record<string, string | Blob>,
    })
  );
  return {
    illustration: parseDBDates(response.illustration),
    song: parseDBDates(response.song),
    prompt: parseDBDates(response.prompt),
  };
};

export const generateIllustration = async (
  adminApi: AdminApi,
  illustrationData: IllustrationGenerateSchema
): Promise<adminIllustrationResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations.generate.$post({ json: illustrationData })
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
  illustrationData: IllustrationModifySchema
): Promise<adminIllustrationResponse> => {
  const response = await makeApiRequest(() =>
    adminApi.illustrations[":id"].$put({
      param: { id: illustrationId },
      json: illustrationData,
    })
  );
  return {
    illustration: parseDBDates(response.illustration),
    song: parseDBDates(response.song),
    prompt: parseDBDates(response.prompt),
  };
};

export const deleteIllustration = async (
  adminApi: AdminApi,
  id: string
): Promise<void> => {
  await makeApiRequest(() =>
    adminApi.illustrations[":id"].$delete({
      param: { id },
    })
  );
};

export const restoreIllustration = async (
  adminApi: AdminApi,
  id: string
): Promise<void> => {
  await makeApiRequest(() =>
    adminApi.illustrations[":id"].restore.$post({
      param: { id },
    })
  );
};

export const deleteIllustrationPrompt = async (
  adminApi: AdminApi,
  id: string
): Promise<void> => {
  await makeApiRequest(() =>
    adminApi.prompts[":id"].$delete({
      param: { id },
    })
  );
};

export const setActiveIllustration = async (
  adminApi: AdminApi,
  songId: string,
  illustrationId: string
): Promise<SongDataDB> => {
  const response = await makeApiRequest(() =>
    adminApi.songs[":songId"]["current-illustration"][":illustrationId"].$put({
      param: {
        songId: songId,
        illustrationId: illustrationId,
      },
    })
  );
  return parseDBDates(response);
};

// Utility functions
export type SongWithIllustrationsAndPrompts = {
  song: SongWithCurrentVersion;
  illustrations: SongIllustrationDB[];
  prompts: Record<string, IllustrationPromptDB>;
};

export const songsWithIllustrationsAndPrompts = (
  songs: SongWithCurrentVersion[],
  illustrations: SongIllustrationDB[],
  prompts: IllustrationPromptDB[]
) => {
  const songIllustrationsPrompts = songs.reduce((acc, s) => {
    acc[s.id] = {
      song: s,
      illustrations: [],
      prompts: {},
    } as SongWithIllustrationsAndPrompts;

    return acc;
  }, {} as Record<string, SongWithIllustrationsAndPrompts>);
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
