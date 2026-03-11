import type { LanguageCount, SortField, SortOrder } from "~/types/types";
import { SongData, to_ascii } from "~/types/songData";
import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";
import { useQueryStore } from "./Toolbar/SearchBar";
import { useSortSettingsStore } from "./Toolbar/SortMenu";
import { RARE_LANGUAGE_THRESHOLD } from "./Toolbar/filters/LanguageFilter";
import { useFilterSettingsStore } from "../SongView/hooks/filterSettingsStore";
import { UserProfileData } from "src/worker/api/userProfile";
import { fetchExternalSearch, Songbook } from "~/services/song-service";
import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";

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
  return songs.filter((song) => song.capo === 0 || song.capo === undefined);
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

const filterExternal = (songs: SongData[], showExternal: boolean) => {
  if (!showExternal) {
    return songs.filter((song) => !song.externalSource);
  } else {
    return songs;
  }
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
  const {
    language,
    selectedSongbooks,
    vocalRange,
    capo,
    onlyFavorites,
    showExternal,
  } = useFilterSettingsStore();

  const { api } = useRouteContext({ from: "__root__" });
  const [triggeredQuery, setTriggeredQuery] = useState<string | null>(null);
  const hasTriggeredExternalSearch = query === triggeredQuery;

  // Reset query on sort change
  useEffect(() => {
    setQuery("");
  }, [sortByField, sortOrder, setQuery]);

  const fuse = useMemo(() => {
    return new Fuse(songs, {
      includeScore: true,
      keys: ["title_for_search", "artist_for_search"],
      ignoreLocation: true,
      threshold: 0.4,
    });
  }, [songs]);

  const searchResults = useMemo(() => {
    if (!query) return null;
    return fuse.search(to_ascii(query).toLowerCase());
  }, [query, fuse]);

  // --- External Search Logic ---
  const minFuzzyScore = searchResults?.length
    ? Math.min(...searchResults.map((fs) => fs.score as number))
    : Infinity;

  const isQueryValidForExternal =
    !!query && (minFuzzyScore > 0.05 || query.trim().length >= 7);

  const shouldSearchExternal =
    user.loggedIn &&
    showExternal &&
    isQueryValidForExternal &&
    hasTriggeredExternalSearch;

  const { data: rawExternalSongs = [], isFetching: isLoadingExternal } =
    useQuery({
      queryKey: ["externalSearch", query],
      queryFn: async () => {
        return await fetchExternalSearch(api, query);
      },
      enabled: shouldSearchExternal,
      staleTime: 1000 * 60 * 5,
      structuralSharing: false,
    });

  const sortedExternalSongs = useMemo(() => {
    if (rawExternalSongs.length === 0 || !query) {
      return rawExternalSongs;
    }
    const externalFuse = new Fuse(rawExternalSongs, {
      includeScore: true,
      keys: ["title_for_search", "artist_for_search"],
      ignoreLocation: true,
      // A threshold of 1.0 forces Fuse to act as a sorter only,
      // never filtering items out of the array.
      threshold: 1.0,
    });

    return externalFuse.search(query).map((r) => r.item);
  }, [rawExternalSongs, query]);
  const displayedSongs = useMemo(() => {
    // 1. If searching, return raw internal search results + fetched external results
    if (query && searchResults) {
      return searchResults.map((r) => r.item);
    }

    // 2. If NOT searching, apply filters and sort
    let results = filterCapo(songs, capo);
    results = filterVocalRange(results, vocalRange);
    results = filterLanguage(results, language, languageCounts);
    results = filterFavorites(results, user.loggedIn, onlyFavorites);
    results = filterExternal(results, showExternal);
    results = filterSongbook(results, availableSongbooks, selectedSongbooks);

    return results.sort(getSortCompareFunction(sortByField, sortOrder));
  }, [
    query,
    searchResults,
    songs,
    capo,
    vocalRange,
    language,
    languageCounts,
    user.loggedIn,
    onlyFavorites,
    showExternal,
    availableSongbooks,
    selectedSongbooks,
    sortByField,
    sortOrder,
  ]);
  return {
    songs: displayedSongs,
    externalSongs: Array.from(sortedExternalSongs),
    isLoadingExternal,
    triggerExternalSearch: () => setTriggeredQuery(query),
    hasTriggeredExternalSearch,
    canSearchExternal: user.loggedIn && showExternal && isQueryValidForExternal,
  };
}
