// Shared YouTube helpers (used by both the web app and the worker). We persist
// only the canonical 11-char video id; watch/thumbnail URLs are reconstructed
// on demand. Accepts a raw id or any common YouTube URL shape so the editor can
// take a pasted link.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Normalize a pasted YouTube URL (or a bare video id) to its 11-char video id.
 * Returns null when nothing video-id-shaped can be extracted, so callers can
 * treat that as a validation failure. Note: only the video id is kept — any
 * `?t=`/start-time or playlist params are intentionally dropped.
 */
export function parseYoutubeId(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a bare id.
  if (VIDEO_ID.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return VIDEO_ID.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    // watch?v=<id>
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID.test(v)) return v;

    // /embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }

  return null;
}

export function isValidYoutubeId(id?: string | null): boolean {
  return !!id && VIDEO_ID.test(id);
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** Autoplaying embed URL, for the Document Picture-in-Picture player. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}?autoplay=1`;
}

/** Max video ids YouTube accepts in a `watch_videos` temporary playlist. */
export const YOUTUBE_PLAYLIST_MAX = 50;

/**
 * Build a URL that opens a temporary YouTube playlist from a list of video ids.
 * YouTube caps `watch_videos` at {@link YOUTUBE_PLAYLIST_MAX} ids, so callers
 * should slice beforehand if they may have more. This 303-redirects to
 * `watch?v=<first>&list=TLGG…`; the `TLGG…` list id is the temp playlist.
 */
export function youtubePlaylistUrl(ids: string[]): string {
  return `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
}

/**
 * Open a (previously minted) temporary playlist in YouTube Music. Unlike
 * youtube.com, Music shows a "Save" button so the user can keep and name the
 * playlist on their own account — no OAuth or API quota. `listId` is the
 * `TLGG…` id from {@link youtubePlaylistUrl}'s redirect; `firstVideoId` seeds
 * the player.
 */
export function youtubeMusicPlaylistUrl(
  firstVideoId: string,
  listId: string,
): string {
  return `https://music.youtube.com/watch?v=${firstVideoId}&list=${listId}`;
}

/** Default thumbnail. `hqdefault` always exists for any public video. */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
