import { API } from "~/../worker/api-client";
import { makeApiRequest } from "./api-service";
export * from "./illustration-service";

export const autofillChordpro = async (
  currentChordPro: string,
  api: API
): Promise<string> => {
  const response = await makeApiRequest(() =>
    api.editor.autofill.$post({
      json: { chordpro: currentChordPro },
    })
  );
  return response.chordpro;
};
