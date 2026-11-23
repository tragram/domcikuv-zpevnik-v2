import { describe, it, expect } from "vitest";
import type { SongData } from "~/types/songData";
import type { LanguageCount, Songbook, SongLanguage } from "~/types/types";
import {
  applyFilters,
  filterBrowseSongs,
  filterFavorites,
  filterLanguage,
  filterSongbook,
  filterVocalRange,
  sortSongs,
} from "./songFilters";
import { RARE_LANGUAGE_THRESHOLD } from "./LanguageFilter";

// Minimal SongData-shaped fixtures — filters only ever touch the fields below.
const song = (overrides: Partial<SongData> = {}): SongData =>
  ({
    id: overrides.id ?? "song-1",
    title: "Title",
    artist: "Artist",
    createdAt: new Date("2024-01-01"),
    isFavorite: false,
    language: undefined,
    capo: undefined,
    range: undefined,
    externalSource: null,
    ...overrides,
  }) as SongData;

describe("filterLanguage", () => {
  const counts = { czech: 10, english: 2 } as LanguageCount;

  it("returns all songs when 'all' is selected", () => {
    const songs = [song({ language: "czech" as SongLanguage })];
    expect(filterLanguage(songs, "all", counts)).toEqual(songs);
  });

  it("filters to an exact language match", () => {
    const czech = song({ id: "a", language: "czech" as SongLanguage });
    const english = song({ id: "b", language: "english" as SongLanguage });
    expect(filterLanguage([czech, english], "czech", counts)).toEqual([czech]);
  });

  it("'other' bucket includes rare languages below the threshold", () => {
    // english's count (2) is below RARE_LANGUAGE_THRESHOLD (3); czech's (10) isn't.
    const rare = song({ id: "a", language: "english" as SongLanguage });
    const common = song({ id: "b", language: "czech" as SongLanguage });
    expect(RARE_LANGUAGE_THRESHOLD).toBe(3);
    expect(filterLanguage([rare, common], "other", counts)).toEqual([rare]);
  });

  it("'other' bucket includes songs with an unknown/invalid language", () => {
    const invalid = song({ id: "a", language: "klingon" as SongLanguage });
    expect(filterLanguage([invalid], "other", counts)).toEqual([invalid]);
  });
});

describe("filterFavorites", () => {
  it("passes everything through when logged out", () => {
    const songs = [song({ isFavorite: false })];
    expect(filterFavorites(songs, false, true)).toEqual(songs);
  });

  it("passes everything through when onlyFavorites is off", () => {
    const songs = [song({ isFavorite: false })];
    expect(filterFavorites(songs, true, false)).toEqual(songs);
  });

  it("keeps only favorites when logged in and onlyFavorites is on", () => {
    const fav = song({ id: "a", isFavorite: true });
    const notFav = song({ id: "b", isFavorite: false });
    expect(filterFavorites([fav, notFav], true, true)).toEqual([fav]);
  });
});

describe("filterVocalRange", () => {
  const withRange = (semitones: number) =>
    song({ range: { semitones } as SongData["range"] });

  it("passes everything through when 'all' is selected", () => {
    const songs = [withRange(5)];
    expect(filterVocalRange(songs, "all")).toEqual(songs);
  });

  it("keeps songs whose range falls within the bounds (inclusive)", () => {
    const inRange = withRange(10);
    const belowRange = withRange(4);
    const aboveRange = withRange(20);
    const result = filterVocalRange(
      [inRange, belowRange, aboveRange],
      [5, 15],
    );
    expect(result).toEqual([inRange]);
  });

  it("excludes songs with no range data", () => {
    const noRange = song({ range: undefined });
    expect(filterVocalRange([noRange], [0, 24])).toEqual([]);
  });
});

describe("filterSongbook", () => {
  const songbooks: Songbook[] = [
    { user: "owner-1", image: "", name: "Owner 1", songIds: new Set(["a"]) },
  ];

  it("passes everything through when no songbook is selected", () => {
    const songs = [song({ id: "a" }), song({ id: "b" })];
    expect(filterSongbook(songs, songbooks, null)).toEqual(songs);
  });

  it("passes everything through when the selected songbook is unknown", () => {
    const songs = [song({ id: "a" })];
    expect(filterSongbook(songs, songbooks, "unknown-owner")).toEqual(songs);
  });

  it("keeps only songs in the selected songbook", () => {
    const inBook = song({ id: "a" });
    const notInBook = song({ id: "b" });
    expect(filterSongbook([inBook, notInBook], songbooks, "owner-1")).toEqual([
      inBook,
    ]);
  });
});

describe("filterBrowseSongs", () => {
  it("shows official versions and the viewer’s pinned pending song", () => {
    const official = song({ id: "official", officialVersionId: "published" });
    const latest = song({ id: "latest", officialVersionId: null, versionId: "unofficial" });
    const pending = song({ id: "pending", officialVersionId: null, versionId: "draft", versionStatus: "pending" });
    const userData = { songbookEntries: new Map([[pending.id, { songId: pending.id, pinnedVersionId: pending.versionId }]]) } as Parameters<typeof filterBrowseSongs>[1];
    expect(filterBrowseSongs([official, latest, pending], null)).toEqual([official]);
    expect(filterBrowseSongs([official, latest, pending], userData)).toEqual([official, pending]);
  });

  it("shows official imports to everyone and unofficial imports to viewers who pinned them", () => {
    const externalSource = { sourceId: "cifraclub", url: "https://example.test", originalContent: "" } as const;
    const official = song({ id: "official", versionId: "source", officialVersionId: "source", externalSource });
    const unofficial = song({ id: "unofficial", versionId: "copy", officialVersionId: null, externalSource });
    const viewer = { songbookEntries: new Map([[unofficial.id, { songId: unofficial.id, pinnedVersionId: unofficial.versionId }]]) } as Parameters<typeof filterBrowseSongs>[1];
    expect(filterBrowseSongs([official, unofficial], null)).toEqual([official]);
    expect(filterBrowseSongs([official, unofficial], viewer)).toEqual([official, unofficial]);
  });
});

describe("applyFilters", () => {
  it("chains all filters together", () => {
    const visible = song({ id: "keep", capo: undefined });
    const latest = song({ id: "latest", officialVersionId: null });
    const capoed = song({ id: "capoed", capo: 3 });

    const result = applyFilters(
      [visible, latest, capoed],
      {
        vocalRange: "all",
        language: "all",
        onlyFavorites: false,
        selectedSongbookId: null,
      },
      { userData: null, availableSongbooks: [] },
    );

    expect(result).toEqual([visible, capoed]);
  });
});

describe("sortSongs", () => {
  it("sorts by title ascending", () => {
    const b = song({ id: "b", title: "Banana" });
    const a = song({ id: "a", title: "Apple" });
    expect(sortSongs([b, a], "title", "ascending")).toEqual([a, b]);
  });

  it("sorts by title descending", () => {
    const b = song({ id: "b", title: "Banana" });
    const a = song({ id: "a", title: "Apple" });
    expect(sortSongs([a, b], "title", "descending")).toEqual([b, a]);
  });

  it("sorts by dateAdded, falling back to title on ties", () => {
    const older = song({
      id: "older",
      title: "Zebra",
      createdAt: new Date("2020-01-01"),
    });
    const newer = song({
      id: "newer",
      title: "Alpha",
      createdAt: new Date("2024-01-01"),
    });
    expect(sortSongs([newer, older], "dateAdded", "ascending")).toEqual([
      older,
      newer,
    ]);
  });

  it("hides songs without a range when sorting by range in either direction", () => {
    const higher = song({
      id: "higher",
      range: { semitones: 10 } as SongData["range"],
    });
    const lower = song({
      id: "lower",
      range: { semitones: 0 } as SongData["range"],
    });
    const withoutRange = song({ id: "without", range: undefined });
    const songs = [higher, withoutRange, lower];
    expect(sortSongs(songs, "range", "ascending")).toEqual([lower, higher]);
    expect(sortSongs(songs, "range", "descending")).toEqual([higher, lower]);
    expect(sortSongs(songs, "title", "ascending")).toContain(withoutRange);
  });

  it("does not mutate the input array", () => {
    const songs = [song({ id: "b", title: "B" }), song({ id: "a", title: "A" })];
    const original = [...songs];
    sortSongs(songs, "title", "ascending");
    expect(songs).toEqual(original);
  });
});
