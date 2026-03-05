import { EditorSubmitSchemaInput } from "src/worker/api/editor";
import { EditorAPI } from "~/../worker/api-client";
import { makeApiRequest } from "./api-service";
export * from "./illustration-service";

export const autofillChordpro = async (
  currentChordPro: string,
  api: EditorAPI,
): Promise<string> => {
  const response = await makeApiRequest(() =>
    api.autofill.$post({
      json: { chordpro: currentChordPro },
    }),
  );
  return response.chordpro;
};

export const submitSongVersion = async (
  editorApi: EditorAPI,
  payload: EditorSubmitSchemaInput,
  songId?: string,
) => {
  return await makeApiRequest(() =>
    songId
      ? editorApi[":id"].$put({
          param: { id: songId },
          json: payload,
        })
      : editorApi.$post({ json: payload }),
  );
};

export const generateSongIllustration = (
  songId: string,
  imageModel: string,
  promptVersion: string,
  summaryModel: string,
) => {
  const generationParams = {
    songId,
    setAsActive: true,
    imageModel,
    promptVersion,
    summaryModel,
  };

  return fetch("/api/illustrations/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(generationParams),
    keepalive: true,
  });
};
