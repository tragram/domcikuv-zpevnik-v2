import { EditorSubmitSchemaInput } from "src/worker/api/editor";
import client from "~/../worker/api-client";
import { makeApiRequest } from "./api-service";

export const autofillChordpro = async (
  currentChordPro: string,
): Promise<string> => {
  const response = await makeApiRequest(() =>
    client.api.editor.autofill.$post({
      json: { chordpro: currentChordPro },
    }),
  );
  return response.chordpro;
};

export const submitSongVersion = async (
  payload: EditorSubmitSchemaInput,
  songId?: string,
) => {
  return await makeApiRequest(() =>
    songId
      ? client.api.editor[":id"].$put({
          param: { id: songId },
          json: payload,
        })
      : client.api.editor.$post({ json: payload }),
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
