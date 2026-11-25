import type { EditorSubmitSchemaInput } from "src/lib/contracts/editor-schema";
import type { YoutubeSearchResult } from "src/worker/api/youtube";
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

/** Top YouTube video for the query, or null if nothing was found. */
export const searchYoutube = async (
  query: string,
): Promise<YoutubeSearchResult | null> => {
  return await makeApiRequest(() =>
    client.api.youtube.search.$get({ query: { q: query } }),
  );
};

/**
 * Create a real, unlisted playlist on the signed-in user's own YouTube account
 * via the Data API and add the given videos to it.
 */
export const createYoutubePlaylist = async (
  videoIds: string[],
  title?: string,
) => {
  return await makeApiRequest(() =>
    client.api.youtube.playlist.$post({ json: { videoIds, title } }),
  );
};

export const submitSongVersion = async (
  payload: EditorSubmitSchemaInput,
  songId?: string,
  options?: { editAsPreviousAuthor?: boolean; addToFavorites?: boolean; publish?: boolean },
) => {
  return await makeApiRequest(() =>
    songId
      ? client.api.editor[":id"].$put({
          param: { id: songId },
          json: { ...payload, ...options },
        })
      : client.api.editor.$post({ json: payload }),
  );
};

export const generateSongIllustration = (songId: string, versionId?: string) => {
  const generationParams = {
    songId,
    versionId,
    setAsActive: true,
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
