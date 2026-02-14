import type { LanguageCount, SortField, SortOrder } from "~/types/types";
import { SongData } from "~/types/songData";
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

const filterExternal = (
  songs: SongData[],
  loggedIn: boolean,
  showExternal: boolean,
) => {
  if (!loggedIn || !showExternal) {
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

  const [externalSearchTriggered, setExternalSearchTriggered] = useState(false);
  const { api } = useRouteContext({ from: "__root__" });
  // Reset external search trigger when the query changes
  useEffect(() => {
    setExternalSearchTriggered(false);
  }, [query]);

  // Reset query on sort change (optional, legacy behavior preserved)
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
  filteredInternalResults = filterExternal(
    filteredInternalResults,
    user.loggedIn,
    showExternal,
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
  const isQueryValidForExternal = query.trim().length >= 3;

  const shouldSearchExternal =
    user.loggedIn &&
    showExternal &&
    isQueryValidForExternal &&
    externalSearchTriggered;

  const { data: externalSongs = [], isFetching: isLoadingExternal } = useQuery({
    queryKey: ["externalSearch", query],
    queryFn: async () => {
      const results = await fetchExternalSearch(api, query);
      return results.map(SongData.fromExternal);
    },
    // Only fetch when the trigger is active
    enabled: shouldSearchExternal,
    staleTime: 1000 * 60 * 5,
  });

  // Apply fuse search to external results for relevance sorting
  const sortedExternalSongs = useMemo(() => {
    if (externalSongs.length === 0 || !query) {
      return externalSongs;
    }

    const externalFuse = new Fuse(externalSongs, {
      includeScore: true,
      keys: ["artist", "title", "ascii_title", "ascii_artist"],
      ignoreLocation: true,
      threshold: 0.4,
    });

    return externalFuse.search(query).map((r) => r.item);
  }, [externalSongs, query]);

  return {
    songs: filteredInternalResults,
    externalSongs: sortedExternalSongs,
    isLoadingExternal,
    triggerExternalSearch: () => setExternalSearchTriggered(true),
    hasTriggeredExternalSearch: externalSearchTriggered,
    canSearchExternal: user.loggedIn && showExternal && isQueryValidForExternal,
  };
}
