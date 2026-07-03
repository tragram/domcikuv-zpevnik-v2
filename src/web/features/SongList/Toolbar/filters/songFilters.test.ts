import { describe, it, expect } from "vitest";
import type { SongData } from "~/types/songData";
import type { LanguageCount, Songbook, SongLanguage } from "~/types/types";
import {
  applyFilters,
  filterCapo,
  filterExternal,
  filterFavorites,
  filterHidden,
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
    hidden: false,
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

describe("filterCapo", () => {
  it("passes everything through when hideCapo is off", () => {
    const songs = [song({ capo: 3 })];
    expect(filterCapo(songs, false)).toEqual(songs);
  });

  it("keeps only songs with no capo or capo 0 when hideCapo is on", () => {
    const none = song({ id: "a", capo: undefined });
    const zero = song({ id: "b", capo: 0 });
    const capoed = song({ id: "c", capo: 2 });
    expect(filterCapo([none, zero, capoed], true)).toEqual([none, zero]);
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

describe("filterExternal", () => {
  const external = { sourceId: "cifraclub" } as SongData["externalSource"];

  it("hides external songs when logged out, regardless of showExternal", () => {
    const ext = song({ externalSource: external });
    const own = song({ id: "b", externalSource: null });
    expect(filterExternal([ext, own], false, true)).toEqual([own]);
  });

  it("hides external songs when showExternal is off", () => {
    const ext = song({ externalSource: external });
    const own = song({ id: "b", externalSource: null });
    expect(filterExternal([ext, own], true, false)).toEqual([own]);
  });

  it("shows external songs when logged in and showExternal is on", () => {
    const songs = [song({ externalSource: external })];
    expect(filterExternal(songs, true, true)).toEqual(songs);
  });
});

describe("filterHidden", () => {
  it("excludes hidden songs that aren't a favorite", () => {
    const hidden = song({ hidden: true, isFavorite: false });
    const visible = song({ id: "b", hidden: false });
    expect(filterHidden([hidden, visible])).toEqual([visible]);
  });

  it("keeps hidden songs that are the user's own favorite", () => {
    const hiddenFavorite = song({ hidden: true, isFavorite: true });
    expect(filterHidden([hiddenFavorite])).toEqual([hiddenFavorite]);
  });
});

describe("applyFilters", () => {
  it("chains all filters together", () => {
    const visible = song({ id: "keep", hidden: false, capo: undefined });
    const hidden = song({ id: "hidden", hidden: true, isFavorite: false });
    const capoed = song({ id: "capoed", capo: 3 });

    const result = applyFilters(
      [visible, hidden, capoed],
      {
        hideCapo: true,
        vocalRange: "all",
        language: "all",
        onlyFavorites: false,
        showExternal: false,
        selectedSongbookId: null,
      },
      { userData: null, availableSongbooks: [] },
    );

    expect(result).toEqual([visible]);
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

  it("sorts by range, treating missing range as lowest", () => {
    const withRange = song({
      id: "with",
      range: { semitones: 10 } as SongData["range"],
    });
    const withoutRange = song({ id: "without", range: undefined });
    expect(sortSongs([withRange, withoutRange], "range", "ascending")).toEqual(
      [withoutRange, withRange],
    );
  });

  it("does not mutate the input array", () => {
    const songs = [song({ id: "b", title: "B" }), song({ id: "a", title: "A" })];
    const original = [...songs];
    sortSongs(songs, "title", "ascending");
    expect(songs).toEqual(original);
  });
});
