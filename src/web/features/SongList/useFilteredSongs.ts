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
import {
  searchAllExternalServices,
  usePAToken,
} from "./Toolbar/ExternalSearch";
import { useQuery } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";
const filterLanguage = (
  songs: SongData[],
  selectedLanguage: string,
  languageCounts: LanguageCount,
): SongData[] => {
  if (selectedLanguage === "all") {
    return songs;
  }
  if (selectedLanguage === "other") {
    return songs.filter((song) => {
      const lang = song.language || "other";
      return languageCounts[lang] < RARE_LANGUAGE_THRESHOLD;
    });
  }
  return songs.filter((song) => song.language === selectedLanguage);
};

const filterFavorites = (
  songs: SongData[],
  loggedIn: boolean,
  onlyFavorites: boolean,
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
  vocalRange: "all" | [number, number],
): SongData[] => {
  if (vocalRange === "all") {
    return songs;
  }
  return songs.filter(
    (song) =>
      song.range?.semitones !== undefined &&
      song.range.semitones >= vocalRange[0] &&
      song.range.semitones <= vocalRange[1],
  );
};

export const filterSongbook = (
  songs: SongData[],
  availableSongbooks: Songbook[],
  selectedSongbooks: Songbook[],
) => {
  if (availableSongbooks.length === 0 || selectedSongbooks.length === 0) {
    return songs;
  }

  let contentsOfSelectedSongbooks = new Set<string>();
  selectedSongbooks.forEach((s) => {
    contentsOfSelectedSongbooks = contentsOfSelectedSongbooks.union(
      new Set(s.songIds),
    );
  });
  return songs.filter((s) => contentsOfSelectedSongbooks.has(s.id));
};

const getSortCompareFunction = (
  sortByField: SortField,
  sortOrder: SortOrder,
) => {
  return (a: SongData, b: SongData): number => {
    let comparison: number;

    if (sortByField === "range") {
      const aSemi = a.range?.semitones ?? -Infinity;
      const bSemi = b.range?.semitones ?? -Infinity;
      comparison =
        aSemi === bSemi ? a.title.localeCompare(b.title) : aSemi - bSemi;
    } else if (sortByField === "dateAdded") {
      const aDate = a.createdAt.getTime();
      const bDate = b.createdAt.getTime();
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
  availableSongbooks: Songbook[],
) {
  const { field: sortByField, order: sortOrder } = useSortSettingsStore();
  const { query, setQuery } = useQueryStore();
  const { language, selectedSongbooks, vocalRange, capo, onlyFavorites } =
    useFilterSettingsStore();

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

  const fuseSearch = useMemo(
    () =>
      query === ""
        ? songs.map((s) => {
            return { item: s, score: 0 };
          })
        : fuse.search(query),
    [fuse, songs, query],
  );

  // fuzzyScore \in [0,1], where 0 ~ perfect match and 1 ~ completely fuzzy match (i.e. no match)
  const minFuzzyScore = Math.min(...fuseSearch.map((fs) => fs.score as number));
  const internalSearchResults = fuseSearch.map((r) => r.item);

  let filteredInternalResults = filterCapo(internalSearchResults, capo);
  filteredInternalResults = filterVocalRange(
    filteredInternalResults,
    vocalRange,
  );
  filteredInternalResults = filterLanguage(
    filteredInternalResults,
    language,
    languageCounts,
  );
  filteredInternalResults = filterFavorites(
    filteredInternalResults,
    user.loggedIn,
    onlyFavorites,
  );
  filteredInternalResults = filterSongbook(
    filteredInternalResults,
    availableSongbooks,
    selectedSongbooks,
  );

  if (!query) {
    filteredInternalResults = [...filteredInternalResults].sort(
      getSortCompareFunction(sortByField, sortOrder),
    );
  }

  // --- External Search Logic ---
  // Debounce the query to prevent spamming APIs while typing
  const [debouncedQuery] = useDebounceValue(query, 500);

  const shouldSearchExternal =
    user.loggedIn &&
    debouncedQuery.trim().length >= 5 &&
    (minFuzzyScore > 0.1 || internalSearchResults.length === 0);

  // Fetch PA token lazily - only when external search is needed
  const { data: paToken } = usePAToken(shouldSearchExternal);

  const { data: externalSongs = [], isFetching: isLoadingExternal } = useQuery({
    queryKey: ["externalSearch", debouncedQuery],
    queryFn: async () => {
      // Only search if we have a token
      if (!paToken) return [];
      const results = await searchAllExternalServices(
        debouncedQuery,
        paToken.PAToken,
      );
      return results.map(SongData.fromExternal);
    },
    // Only enable external search if we should search AND we have a token
    enabled: shouldSearchExternal && !!paToken,
    staleTime: 1000 * 60 * 5,
  });

  return {
    songs: filteredInternalResults,
    externalSongs,
    isLoadingExternal,
    shouldSearchExternal,
  };
}
