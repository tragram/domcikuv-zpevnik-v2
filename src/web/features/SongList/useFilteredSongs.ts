import type { LanguageCount, SortField, SortOrder } from "~/types/types";
import { SongData } from "~/types/songData";
import Fuse from "fuse.js";
import { useEffect, useMemo } from "react";
import { useQueryStore } from "./Toolbar/SearchBar";
import { useSortSettingsStore } from "./Toolbar/SortMenu";
import { RARE_LANGUAGE_THRESHOLD } from "./Toolbar/filters/LanguageFilter";
import { useFilterSettingsStore } from "../SongView/hooks/filterSettingsStore";
import { UserProfileData } from "src/worker/api/userProfile";
import { Songbook } from "~/services/songs";

const filterLanguage = (
  songs: SongData[],
  selectedLanguage: string,
  languageCounts: LanguageCount
): SongData[] => {
  if (selectedLanguage === "all") {
    return songs;
  }

  if (selectedLanguage === "other") {
    // Count all languages across the song database

    // Return songs with languages that have fewer than x songs
    return songs.filter((song) => {
      const lang = song.language || "other";
      return languageCounts[lang] < RARE_LANGUAGE_THRESHOLD;
    });
  }

  // Standard language filtering
  return songs.filter((song) => song.language === selectedLanguage);
};

const filterFavorites = (
  songs: SongData[],
  loggedIn: boolean,
  onlyFavorites: boolean
) => {
  if (loggedIn && onlyFavorites) {
    return songs.filter((song) => song.isFavorite);
  } else {
    return songs;
  }
};

const filterCapo = (songs: SongData[], allowCapo: boolean): SongData[] => {
  if (allowCapo) {
    return songs;
  }
  return songs.filter((song) => song.capo === 0);
};

const filterVocalRange = (
  songs: SongData[],
  vocalRange: "all" | [number, number]
): SongData[] => {
  if (vocalRange === "all") {
    return songs;
  }
  return songs.filter(
    (song) =>
      song.range?.semitones !== undefined &&
      song.range.semitones >= vocalRange[0] &&
      song.range.semitones <= vocalRange[1]
  );
};

export const filterSongbook = (
  songs: SongData[],
  availableSongbooks: Songbook[],
  selectedSongbooks: Songbook[]
) => {
  if (availableSongbooks.length === 0 || selectedSongbooks.length === 0) {
    return songs;
  }

  let contentsOfSelectedSongbooks = new Set<string>();
  selectedSongbooks.forEach((s) => {
    contentsOfSelectedSongbooks = contentsOfSelectedSongbooks.union(
      new Set(s.songIds)
    );
  });
  return songs.filter((s) => contentsOfSelectedSongbooks.has(s.id));
};

const getSortCompareFunction = (
  sortByField: SortField,
  sortOrder: SortOrder
) => {
  return (a: SongData, b: SongData): number => {
    let comparison: number;

    if (sortByField === "range") {
      const aSemi = a.range?.semitones ?? -Infinity;
      const bSemi = b.range?.semitones ?? -Infinity;
      comparison =
        aSemi === bSemi ? a.title.localeCompare(b.title) : aSemi - bSemi;
    } else if (sortByField === "dateAdded") {
      const aDate = a.createdAt.getDate();
      const bDate = b.createdAt.getDate();
      comparison =
        aDate === bDate ? a.title.localeCompare(b.title) : aDate - bDate;
    } else {
      comparison = (a[sortByField] ?? "").localeCompare(b[sortByField] ?? "");
    }

    return sortOrder === "ascending" ? comparison : -comparison;
  };
};

export function useFilteredSongs(
  songs: SongData[],
  languageCounts: LanguageCount,
  user: UserProfileData,
  availableSongbooks: Songbook[]
) {
  const { field: sortByField, order: sortOrder } = useSortSettingsStore();
  const { query, setQuery } = useQueryStore();
  const { language, selectedSongbooks, vocalRange, capo, onlyFavorites } =
    useFilterSettingsStore();
  // Reset search when sort settings change
  useEffect(() => {
    setQuery("");
  }, [sortByField, sortOrder, setQuery]);

  const fuse = useMemo(() => {
    const options = {
      includeScore: true,
      keys: ["artist", "title", "ascii_title", "ascii_artist"],
      ignoreLocation: true,
      threshold: 0.4,
    };
    return new Fuse(songs, options);
  }, [songs]);

  const searchResults = useMemo(
    () => (query === "" ? songs : fuse.search(query).map((r) => r.item)),
    [fuse, songs, query]
  );

  // Apply filters
  let results = filterCapo(searchResults, capo);
  results = filterVocalRange(results, vocalRange);
  results = filterLanguage(results, language, languageCounts);
  results = filterFavorites(results, user.loggedIn, onlyFavorites);
  results = filterSongbook(results, availableSongbooks, selectedSongbooks);
  // Only sort if there's no search query
  if (!query) {
    results = [...results].sort(getSortCompareFunction(sortByField, sortOrder));
  }
  return { songs: results };
}
