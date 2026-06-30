import { failJSend, successJSend } from "./responses";
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

const youtubeApp = buildApp().get("/search", async (c) => {
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
