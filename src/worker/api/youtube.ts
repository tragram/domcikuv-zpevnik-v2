import { z } from "zod";
import {
  isValidYoutubeId,
  YOUTUBE_PLAYLIST_MAX,
  youtubePlaylistUrl,
} from "src/lib/youtube";
import { failJSend, successJSend, zValidatorJSend } from "./responses";
import { buildApp } from "./utils";

export type YoutubeSearchResult = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailURL?: string;
};

type YoutubeApiSearchResponse = {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url?: string } | undefined>;
    };
  }[];
};

const playlistBodySchema = z.object({
  videoIds: z.array(z.string()).min(1),
});

const youtubeApp = buildApp()
  .post(
    "/playlist",
    zValidatorJSend("json", playlistBodySchema),
    async (c) => {
      const ids = c.req
        .valid("json")
        .videoIds.filter(isValidYoutubeId)
        .slice(0, YOUTUBE_PLAYLIST_MAX);
      if (ids.length === 0)
        return failJSend(c, "No valid YouTube video ids", 400, "NO_VALID_IDS");

      // `watch_videos` mints a temporary playlist and 303-redirects to
      // watch?v=<first>&list=TLGG…. We resolve that redirect server-side (the
      // browser can't read youtube.com's cross-origin Location) and return the
      // list id, which YouTube Music accepts and lets the user save + name.
      let listId: string | null = null;
      try {
        const res = await fetch(youtubePlaylistUrl(ids), {
          redirect: "manual",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          },
        });
        const location = res.headers.get("location");
        if (location)
          listId = new URL(
            location,
            "https://www.youtube.com",
          ).searchParams.get("list");
      } catch {
        /* fall through to the failure response below */
      }

      if (!listId)
        return failJSend(
          c,
          "Could not create the YouTube playlist",
          502,
          "PLAYLIST_CREATE_FAILED",
        );

      return successJSend(c, { listId, firstVideoId: ids[0] });
    },
  )
  .get("/search", async (c) => {
  const user = c.var.USER;
  if (!user)
    return failJSend(c, "Authentication required", 401, "AUTH_REQUIRED");

  const query = c.req.query("q")?.trim();
  // Mirror external search: a too-short query just yields nothing rather than an
  // error, so the client can call freely while the user is still typing.
  if (!query || query.length < 2) return successJSend(c, null);

  // The YouTube Data API takes a plain Google API key; reuse the project's
  // shared GOOGLE_API_KEY when a dedicated one isn't configured.
  const apiKey = c.env.YOUTUBE_API_KEY || c.env.GOOGLE_API_KEY;
  if (!apiKey)
    return failJSend(c, "Server configuration error", 500, "MISSING_API_KEY");

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    // The YouTube Data API signals an exhausted/limited key with HTTP 403 and a
    // reason of quotaExceeded / dailyLimitExceeded / rateLimitExceeded.
    let reason: string | undefined;
    try {
      const errorBody = (await response.json()) as {
        error?: { errors?: { reason?: string }[] };
      };
      reason = errorBody.error?.errors?.[0]?.reason;
    } catch {
      /* non-JSON error body — fall through to the generic message */
    }

    if (
      response.status === 403 &&
      (reason === "quotaExceeded" ||
        reason === "dailyLimitExceeded" ||
        reason === "rateLimitExceeded")
    ) {
      return failJSend(
        c,
        "YouTube search is unavailable right now — the daily search quota has been reached. Please try again tomorrow, or paste the video link manually.",
        429,
        "YOUTUBE_QUOTA_EXCEEDED",
      );
    }

    return failJSend(c, "YouTube search failed", 502, "YOUTUBE_SEARCH_FAILED");
  }

  const data = (await response.json()) as YoutubeApiSearchResponse;
  const top = data.items?.[0];
  const id = top?.id?.videoId;
  if (!id) return successJSend(c, null);

  const thumbnails = top?.snippet?.thumbnails ?? {};
  const result: YoutubeSearchResult = {
    id,
    title: top?.snippet?.title ?? "",
    channelTitle: top?.snippet?.channelTitle ?? "",
    thumbnailURL:
      thumbnails.medium?.url ?? thumbnails.default?.url ?? undefined,
  };
  return successJSend(c, result);
});

export default youtubeApp;
