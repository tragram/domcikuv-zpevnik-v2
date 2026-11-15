import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SongDataApi } from "src/worker/api/api-types";
import { SongData } from "~/types/songData";
import { getSongDB } from "~/hooks/use-songDB";
import { findOrFetchSong } from "./song-service";
import songLoader from "./song-loader";

vi.mock("~/hooks/use-songDB", () => ({
  getSongDB: vi.fn(),
  songsQueryOptions: () => ({ queryKey: ["songs"] }),
}));
vi.mock("~/hooks/use-user-data", () => ({
  getSessionUserId: () => "viewer",
  favoritesQueryOptions: (id: string) => ({ queryKey: ["favorites", id] }),
  songbookEntriesQueryOptions: (id: string) => ({ queryKey: ["songbookEntries", id] }),
}));
vi.mock("./song-service", () => ({ findOrFetchSong: vi.fn() }));

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
const ownPin = {
  ...canonical,
  versionId: "viewer-pin",
  customVersionAuthor: { id: "viewer", name: "Viewer" },
};
let queryClient: QueryClient;

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  queryClient.setQueryData(["songs"], [canonical]);
  queryClient.setQueryData(["favorites", "viewer"], [{
    songId: "song", pinnedVersionId: "viewer-pin", song: ownPin,
  }]);
  vi.mocked(getSongDB).mockResolvedValue({
    songs: [new SongData(ownPin)],
    songbooks: [{ user: "owner", name: "Anna" }],
  } as Awaited<ReturnType<typeof getSongDB>>);
  vi.mocked(findOrFetchSong).mockImplementation(async (songs, songId) => {
    const song = songs.find((s) => s.id === songId)!;
    return song instanceof SongData ? song : new SongData(song);
  });
});

function load(deps: { songbook?: string; version?: string } = {}) {
  return songLoader({ context: { queryClient }, params: { songId: "song" }, deps });
}

describe("song version selection", () => {
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
    const result = await load({ songbook: "owner" });
    expect(result.songData.versionId).toBe("official");
    expect(result.versionSelection.unavailable).toBe(true);
  });

  it("uses the viewer's saved version in their own context", async () => {
    const result = await load();
    expect(result.songData.versionId).toBe("viewer-pin");
    expect(result.versionSelection).toEqual({ source: "saved", unavailable: false });
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
