import { describe, it, expect } from "vitest";
import {
  isValidYoutubeId,
  parseYoutubeId,
  youtubeEmbedUrl,
  youtubeMusicPlaylistUrl,
  youtubePlaylistUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
  YOUTUBE_PLAYLIST_MAX,
} from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYoutubeId", () => {
  it("returns null for empty/missing input", () => {
    expect(parseYoutubeId(undefined)).toBeNull();
    expect(parseYoutubeId(null)).toBeNull();
    expect(parseYoutubeId("")).toBeNull();
    expect(parseYoutubeId("   ")).toBeNull();
  });

  it("accepts a bare video id", () => {
    expect(parseYoutubeId(ID)).toBe(ID);
    expect(parseYoutubeId(`  ${ID}  `)).toBe(ID);
  });

  it("extracts the id from watch URLs", () => {
    expect(parseYoutubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("drops extra params like start time or playlist", () => {
    expect(
      parseYoutubeId(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`),
    ).toBe(ID);
  });

  it("extracts the id from youtu.be short links", () => {
    expect(parseYoutubeId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://youtu.be/${ID}?t=10`)).toBe(ID);
  });

  it("extracts the id from embed/shorts/live/v paths", () => {
    expect(parseYoutubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
    expect(parseYoutubeId(`https://www.youtube.com/v/${ID}`)).toBe(ID);
  });

  it("returns null for unrelated URLs or malformed input", () => {
    expect(parseYoutubeId("https://example.com/watch?v=" + ID)).toBeNull();
    expect(parseYoutubeId("not a url and not an id")).toBeNull();
    expect(parseYoutubeId("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("isValidYoutubeId", () => {
  it("validates 11-char ids only", () => {
    expect(isValidYoutubeId(ID)).toBe(true);
    expect(isValidYoutubeId("tooshort")).toBe(false);
    expect(isValidYoutubeId(undefined)).toBe(false);
    expect(isValidYoutubeId(null)).toBe(false);
  });
});

describe("URL builders", () => {
  it("builds a watch URL", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
  });

  it("builds a thumbnail URL", () => {
    expect(youtubeThumbnailUrl(ID)).toBe(
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    );
  });

  it("builds a temporary playlist URL from ids", () => {
    const ids = [ID, "abcdefghijk"];
    expect(youtubePlaylistUrl(ids)).toBe(
      `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`,
    );
  });

  it("caps the playlist size at YOUTUBE_PLAYLIST_MAX", () => {
    expect(YOUTUBE_PLAYLIST_MAX).toBe(50);
  });

  it("builds an autoplaying embed URL", () => {
    expect(youtubeEmbedUrl(ID)).toBe(
      `https://www.youtube.com/embed/${ID}?autoplay=1`,
    );
  });

  it("builds a YouTube Music playlist URL", () => {
    expect(youtubeMusicPlaylistUrl(ID, "TLGGabc")).toBe(
      `https://music.youtube.com/watch?v=${ID}&list=TLGGabc`,
    );
  });
});
