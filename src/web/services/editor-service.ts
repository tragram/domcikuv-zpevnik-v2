import { EditorSubmitSchemaInput } from "src/worker/api/editor";
import { YoutubeSearchResult } from "src/worker/api/youtube";
import { youtubeMusicPlaylistUrl } from "src/lib/youtube";
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
 * Turn selected video ids into a YouTube Music playlist URL the user can save
 * (and name) under their own account. The worker mints a temporary playlist via
 * `watch_videos` and returns its list id; we build the Music URL from it.
 */
export const createYoutubePlaylist = async (
  videoIds: string[],
): Promise<string> => {
  const { listId, firstVideoId } = await makeApiRequest(() =>
    client.api.youtube.playlist.$post({ json: { videoIds } }),
  );
  return youtubeMusicPlaylistUrl(firstVideoId, listId);
};

export const submitSongVersion = async (
  payload: EditorSubmitSchemaInput,
  songId?: string,
  options?: { editAsSubmitter?: boolean },
) => {
  return await makeApiRequest(() =>
    songId
      ? client.api.editor[":id"].$put({
          param: { id: songId },
          json: { ...payload, editAsSubmitter: options?.editAsSubmitter },
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
