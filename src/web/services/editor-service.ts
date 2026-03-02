import { API } from "~/../worker/api-client";
import { makeApiRequest } from "./api-service";
import { EditorSubmitSchemaInput } from "src/worker/api/editor";
export * from "./illustration-service";

export const autofillChordpro = async (
  currentChordPro: string,
  api: API,
): Promise<string> => {
  const response = await makeApiRequest(() =>
    api.editor.autofill.$post({
      json: { chordpro: currentChordPro },
    }),
  );
  return response.chordpro;
};

export const submitSongVersion = async (
  editorApi: API["editor"],
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
