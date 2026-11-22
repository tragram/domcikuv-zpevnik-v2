import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SongDataApi } from "src/worker/api/api-types";
import { SongData } from "~/types/songData";
import { findOrFetchSong } from "./song-service";
import songLoader from "./song-loader";
import { getSessionUserId } from "~/hooks/use-user-data";
import { getIsOnline } from "~/hooks/use-is-online";
import { ApiException } from "./api-service";

vi.mock("~/hooks/use-songDB", () => ({
  songsQueryOptions: () => ({ queryKey: ["songs"] }),
  publicSongbooksQueryOptions: () => ({ queryKey: ["publicSongbooks"] }),
}));
vi.mock("~/hooks/use-user-data", async (importOriginal) => ({
  ...await importOriginal<typeof import("~/hooks/use-user-data")>(),
  getSessionUserId: vi.fn(() => "viewer"),
  favoritesQueryOptions: (id: string) => ({ queryKey: ["favorites", id] }),
  songbookEntriesQueryOptions: (id: string) => ({ queryKey: ["songbookEntries", id] }),
}));
vi.mock("./song-service", () => ({
  findOrFetchSong: vi.fn(),
  getCachedSongVersion: (cache: QueryClient, songId: string, versionId: string, songs: SongDataApi[] = []) =>
    cache.getQueryData(["song", "fetch", songId, versionId]) ?? songs.find((song) => song.id === songId && song.versionId === versionId),
}));
vi.mock("~/hooks/use-is-online", () => ({ getIsOnline: vi.fn(() => true), useIsOnline: () => true }));

const canonical: SongDataApi = {
  id: "song",
  versionId: "official",
  title: "Song",
  artist: "Artist",
  chordpro: "[C]Lyrics",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  externalSource: null,
};

it("preserves the published version IDs through offline serialization", () => {
  const song = new SongData({ ...canonical, publishedVersionIds: ["official", "alternative"] });
  expect(new SongData(JSON.parse(JSON.stringify(song))).publishedVersionIds).toEqual(["official", "alternative"]);
});
const ownPin = {
  ...canonical,
  versionId: "viewer-pin",
  versionAuthor: { id: "viewer", name: "Viewer" },
};
let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEV", false);
  vi.mocked(getSessionUserId).mockReturnValue("viewer");
  vi.mocked(getIsOnline).mockReturnValue(true);
  queryClient = new QueryClient();
  queryClient.setQueryData(["session"], { user: { id: "viewer" } });
  queryClient.setQueryData(["songs"], [canonical]);
  queryClient.setQueryData(["publicSongbooks"], [{ user: "owner", name: "Anna" }]);
  queryClient.setQueryData(["favorites", "viewer"], [{
    songId: "song", pinnedVersionId: "viewer-pin", song: ownPin,
  }]);
  vi.mocked(findOrFetchSong).mockImplementation(async (songs, songId) => {
    const song = songs.find((s) => s.id === songId)!;
    return song instanceof SongData ? song : new SongData(song);
  });
});
afterEach(() => vi.unstubAllEnvs());

function load(deps: { songbook?: string; version?: string } = {}) {
  return songLoader({ context: { queryClient }, params: { songId: "song" }, deps });
}

describe("song version selection", () => {
  it("opens a cached personal sheet without waiting for directory or contribution downloads", async () => {
    queryClient.setQueryData(["session"], { user: { id: "viewer" } });
    queryClient.removeQueries({ queryKey: ["publicSongbooks"] });
    queryClient.setQueryDefaults(["publicSongbooks"], { queryFn: () => new Promise(() => {}) });
    queryClient.setQueryDefaults(["submissions"], { queryFn: () => new Promise(() => {}) });
    const result = await load();
    expect(result.songData.versionId).toBe("viewer-pin");
    expect(result.songData.isFavorite).toBe(true);
  });

  it("opens cached official songs immediately for a signed-out visitor", async () => {
    queryClient.setQueryData(["session"], null);
    vi.mocked(getSessionUserId).mockReturnValue(undefined);
    expect((await load()).songData.versionId).toBe("official");
  });

  it("opens the catalog immediately while personal context is cold", async () => {
    queryClient.removeQueries({ queryKey: ["favorites"] });
    const fetchFavorites = vi.fn(async () => [{ songId: "song", pinnedVersionId: "viewer-pin", song: ownPin }]);
    queryClient.setQueryDefaults(["favorites", "viewer"], { queryFn: fetchFavorites });
    expect((await load()).songData.versionId).toBe("official");
    expect(fetchFavorites).not.toHaveBeenCalled();
  });
  it("does not leak the viewer's pin into another person's official songbook entry", async () => {
    queryClient.setQueryData(["songbookEntries", "owner"], [{
      songId: "song", pinnedVersionId: null, keyIndex: null, capo: null,
    }]);
    const result = await load({ songbook: "owner" });
    expect(result.songData.versionId).toBe("official");
    expect(result.versionSelection).toEqual({
      source: "songbook", ownerName: "Anna", unavailable: false,
    });
  });

  it("explains an unavailable owner pin while showing the actual official version", async () => {
    queryClient.setQueryData(["songbookEntries", "owner"], [{
      songId: "song", pinnedVersionId: "missing", keyIndex: null, capo: null,
    }]);
    vi.mocked(findOrFetchSong).mockRejectedValueOnce(new ApiException("Removed", 404));
    const result = await load({ songbook: "owner" });
    expect(result.songData.versionId).toBe("official");
    expect(result.versionSelection.unavailable).toBe(true);
  });

  it("uses the viewer's saved version in their own context", async () => {
    const result = await load();
    expect(result.songData.versionId).toBe("viewer-pin");
    expect(result.versionSelection).toEqual({ source: "saved", unavailable: false });
    expect(findOrFetchSong).not.toHaveBeenCalled();
  });

  it("refreshes cached saved sheets against local D1 during development", async () => {
    vi.stubEnv("DEV", true);
    const currentIllustration = {
      illustrationId: "image",
      promptId: "prompt",
      imageModel: "model",
      imageURL: "/songs/song/prompt/full/model.webp",
      thumbnailURL: "/songs/song/prompt/thumbnail/model.webp",
      promptURL: "",
    };
    vi.mocked(findOrFetchSong).mockResolvedValueOnce(new SongData({ ...ownPin, currentIllustration }));

    expect((await load()).songData.illustrationURL()).toBe(currentIllustration.imageURL);
    expect(findOrFetchSong).toHaveBeenCalledWith([ownPin], "song", "viewer-pin", queryClient);
  });

  it("returns to the official sheet after leaving a foreign book for a guest", async () => {
    queryClient.setQueryData(["session"], null);
    vi.mocked(getSessionUserId).mockReturnValue(undefined);
    queryClient.setQueryData(["songbookEntries", "owner"], [{
      songId: "song", pinnedVersionId: "owner-pin", song: { ...canonical, versionId: "owner-pin" }, keyIndex: 2, capo: 3,
    }]);
    expect((await load({ songbook: "owner" })).songData.versionId).toBe("owner-pin");
    const result = await load();
    expect(result.songData.versionId).toBe("official");
    expect(result.versionSelection).toEqual({ source: "official" });
    expect(result.personalizationOverride).toBeUndefined();
  });

  it("uses the personal cache when opening the viewer's own book", async () => {
    const result = await load({ songbook: "viewer" });
    expect(result.songData.versionId).toBe("viewer-pin");
    expect(result.versionSelection.source).toBe("songbook");
  });

  it("downloads the saved sheet when only the official sheet is cached and the viewer is online", async () => {
    queryClient.setQueryData(["favorites", "viewer"], [{ songId: "song", pinnedVersionId: "viewer-pin" }]);
    vi.mocked(findOrFetchSong).mockResolvedValueOnce(new SongData(ownPin));
    const result = await load();
    expect(result.songData.versionId).toBe("viewer-pin");
    expect(result.versionSelection).toEqual({ source: "saved", unavailable: false });
    expect(findOrFetchSong).toHaveBeenCalledWith([canonical], "song", "viewer-pin", queryClient);
  });

  it("keeps a saved formerly official ID when cached favorites have no inline sheet", async () => {
    queryClient.setQueryData(["favorites", "viewer"], [{ songId: "song", pinnedVersionId: "official" }]);
    queryClient.setQueryData(["songs"], [{ ...canonical, versionId: "new-official" }]);
    queryClient.setQueryData(["song", "fetch", "song", "official"], canonical);
    expect((await load()).songData.versionId).toBe("official");
    expect(findOrFetchSong).not.toHaveBeenCalled();
  });

  it("uses the downloaded official fallback offline when a saved sheet is unavailable", async () => {
    vi.mocked(getIsOnline).mockReturnValue(false);
    queryClient.setQueryData(["favorites", "viewer"], [{ songId: "song", pinnedVersionId: "gone" }]);
    expect((await load()).versionSelection.unavailable).toBe(true);
    expect(findOrFetchSong).not.toHaveBeenCalled();
  });

  it("never substitutes official for an unavailable exact link", async () => {
    vi.mocked(findOrFetchSong).mockRejectedValueOnce(new ApiException("Removed", 404));
    await expect(load({ version: "gone" })).rejects.toMatchObject({ status: 404 });
    expect(findOrFetchSong).toHaveBeenCalledOnce();
  });

  it("gives an explicit version link precedence over songbook selection", async () => {
    vi.mocked(findOrFetchSong).mockResolvedValueOnce(new SongData({
      ...canonical, versionId: "linked",
    }));
    const result = await load({ songbook: "owner", version: "linked" });
    expect(result.songData.versionId).toBe("linked");
    expect(result.versionSelection).toEqual({ source: "link" });
    expect(result.personalizationOverride).toBeUndefined();
  });
});
