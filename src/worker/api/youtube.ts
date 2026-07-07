import { z } from "zod";
import {
  isValidYoutubeId,
  YOUTUBE_PLAYLIST_MAX,
  YOUTUBE_PLAYLIST_SCOPE,
  youtubePlaylistWatchUrl,
} from "src/lib/youtube";
import { auth } from "src/lib/auth/server";
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
  // YouTube caps playlist titles at 150 characters.
  title: z.string().trim().max(150).optional(),
});

/**
 * Create a real, permanent playlist on the user's own YouTube account via the
 * Data API v3, using the `youtube` scope granted through Google sign-in. This
 * replaces an earlier approach that scraped the unofficial `watch_videos`
 * temporary-playlist redirect — that endpoint isn't a stable API, and started
 * failing when fetched from Cloudflare's datacenter IPs (consent interstitials
 * / bot detection). The official API has no such issue.
 */
async function createGoogleYoutubePlaylist(
  accessToken: string,
  videoIds: string[],
  title: string,
): Promise<
  | {
      ok: true;
      playlistId: string;
      addedCount: number;
      failedCount: number;
      quotaExhausted: boolean;
    }
  | { ok: false; status: number; body: string }
> {
  const createRes = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title },
        status: { privacyStatus: "unlisted" },
      }),
    },
  );
  if (!createRes.ok)
    return { ok: false, status: createRes.status, body: await createRes.text() };

  const { id: playlistId } = (await createRes.json()) as { id: string };

  // Inserts must be sequential: YouTube rejects concurrent playlistItems
  // writes into the same playlist with 409s. A single failed video (private/
  // deleted) still shouldn't fail the whole export, so count per item — but
  // when the daily quota runs out mid-export, every remaining insert is
  // doomed too, so bail out and report it distinctly.
  let addedCount = 0;
  let quotaExhausted = false;
  for (const videoId of videoIds) {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } },
        }),
      },
    );
    if (res.ok) {
      addedCount++;
      continue;
    }
    const body = await res.text();
    console.warn("playlistItems.insert failed", videoId, res.status, body);
    if (res.status === 403) {
      let reason: string | undefined;
      try {
        reason = (
          JSON.parse(body) as { error?: { errors?: { reason?: string }[] } }
        ).error?.errors?.[0]?.reason;
      } catch {
        /* non-JSON error body */
      }
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        quotaExhausted = true;
        break;
      }
    }
  }
  return {
    ok: true,
    playlistId,
    addedCount,
    failedCount: videoIds.length - addedCount,
    quotaExhausted,
  };
}

const youtubeApp = buildApp()
  .post(
    "/playlist",
    zValidatorJSend("json", playlistBodySchema),
    async (c) => {
      const user = c.var.USER;
      if (!user)
        return failJSend(
          c,
          "Sign in with Google to export playlists",
          401,
          "AUTH_REQUIRED",
        );

      const ids = c.req
        .valid("json")
        .videoIds.filter(isValidYoutubeId)
        .slice(0, YOUTUBE_PLAYLIST_MAX);
      if (ids.length === 0)
        return failJSend(c, "No valid YouTube video ids", 400, "NO_VALID_IDS");

      const scopeRequiredFail = () =>
        failJSend(
          c,
          "Grant YouTube playlist access to export playlists",
          403,
          "GOOGLE_YOUTUBE_SCOPE_REQUIRED",
        );

      let accessToken: string;
      try {
        const authInstance = auth(c.env, c.var.db);
        const tokenResult = await authInstance.api.getAccessToken({
          body: { providerId: "google", userId: user.id },
        });
        if (!tokenResult.scopes.includes(YOUTUBE_PLAYLIST_SCOPE)) {
          // If the user just went through consent and this still triggers,
          // Google didn't grant the scope (e.g. unverified app + non-test user).
          console.warn("google token missing youtube scope", tokenResult.scopes);
          return scopeRequiredFail();
        }
        if (!tokenResult.accessToken) return scopeRequiredFail();
        accessToken = tokenResult.accessToken;
      } catch (err) {
        // No linked Google account, or the refresh token is missing/expired.
        console.warn("getAccessToken failed for youtube export", err);
        return scopeRequiredFail();
      }

      const title =
        c.req.valid("json").title ||
        `Domčíkův Zpěvník – ${new Date().toISOString().slice(0, 10)}`;
      const result = await createGoogleYoutubePlaylist(accessToken, ids, title);
      if (!result.ok) {
        console.warn("playlists.insert failed", result.status, result.body);
        // Google uses 403 for several unrelated conditions — only report a
        // missing scope when it actually is one, or the client would bounce
        // the user through the consent screen in an endless loop.
        let reason: string | undefined;
        let googleStatus: string | undefined;
        let googleMessage: string | undefined;
        try {
          const parsed = JSON.parse(result.body) as {
            error?: {
              status?: string;
              message?: string;
              errors?: { reason?: string }[];
            };
          };
          reason = parsed.error?.errors?.[0]?.reason;
          googleStatus = parsed.error?.status;
          googleMessage = parsed.error?.message;
        } catch {
          /* non-JSON error body */
        }

        if (
          result.status === 401 ||
          reason === "insufficientPermissions" ||
          reason === "authError" ||
          googleStatus === "UNAUTHENTICATED" ||
          reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
        )
          return scopeRequiredFail();

        if (reason === "accessNotConfigured")
          // Google's message names the project number it checked — surface it
          // verbatim, since "enabled the API in the wrong project" is the
          // classic cause and the message is the only way to tell.
          return failJSend(
            c,
            `YouTube API rejected the request: ${googleMessage ?? "API not enabled for this project"}`,
            502,
            "YOUTUBE_API_NOT_ENABLED",
          );

        if (reason === "quotaExceeded" || reason === "dailyLimitExceeded")
          return failJSend(
            c,
            "YouTube export is unavailable right now — the daily quota has been reached. Please try again tomorrow.",
            429,
            "YOUTUBE_QUOTA_EXCEEDED",
          );

        return failJSend(
          c,
          googleMessage
            ? `Could not create the YouTube playlist: ${googleMessage}`
            : "Could not create the YouTube playlist",
          502,
          "PLAYLIST_CREATE_FAILED",
        );
      }

      return successJSend(c, {
        playlistId: result.playlistId,
        url: youtubePlaylistWatchUrl(result.playlistId),
        addedCount: result.addedCount,
        failedCount: result.failedCount,
        quotaExhausted: result.quotaExhausted,
      });
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
