import Fuse from "fuse.js";
import { useEffect, useMemo } from "react";

import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { SongData, to_ascii } from "~/types/songData";
import type { SongDB } from "~/types/types";
import type { UserData } from "~/hooks/use-user-data";
import { useQueryStore } from "./Toolbar/SearchBar";
import { useSortSettingsStore } from "./Toolbar/SortMenu";
import { applyFilters, sortSongs } from "./Toolbar/filters/songFilters";

export interface DisplayedSongs {
  /** The list to render: fuzzy search results while searching, else filtered + sorted. */
  songs: SongData[];
  /**
   * Best (lowest) fuzzy score among local results, or Infinity when not searching.
   * Consumed by useExternalSearch to decide whether an online search is worth offering.
   */
  bestLocalScore: number;
}

export function useDisplayedSongs(
  songDB: SongDB,
  userData: UserData,
): DisplayedSongs {
  const { field: sortByField, order: sortOrder } = useSortSettingsStore();
  const { query, setQuery } = useQueryStore();
  const { language, vocalRange, hideCapo, onlyFavorites, showExternal, selectedSongbookIds } =
    useFilterSettingsStore();

  // Changing the sort clears an active search: search ignores sort entirely, so
  // this stops the two from implying contradictory orderings.
  useEffect(() => {
    setQuery("");
  }, [sortByField, sortOrder, setQuery]);

  const fuse = useMemo(
    () =>
      new Fuse(songDB.songs, {
        includeScore: true,
        keys: ["title_for_search", "artist_for_search"],
        ignoreLocation: true,
        threshold: 0.4,
      }),
    [songDB.songs],
  );

  const searchResults = useMemo(
    () => (query ? fuse.search(to_ascii(query).toLowerCase()) : null),
    [query, fuse],
  );

  const bestLocalScore = searchResults?.length
    ? Math.min(...searchResults.map((r) => r.score as number))
    : Infinity;

  const songs = useMemo(() => {
    // SEARCH MODE: an active query deliberately bypasses *every* filter-bar
    // setting (capo, language, favorites, songbooks, range, show-external).
    // Search spans the whole local library — and because it skips filterExternal,
    // it is the only way users who aren't logged in can reach external-origin
    // songs (which the normal browse list hides from them).
    if (query && searchResults) {
      return searchResults.map((r) => r.item);
    }
    // BROWSE MODE: filter, then sort.
    return sortSongs(
      applyFilters(
        songDB.songs,
        { language, vocalRange, hideCapo, onlyFavorites, showExternal, selectedSongbookIds },
        {
          userData,
          availableSongbooks: songDB.songbooks,
          languageCounts: songDB.languages,
        },
      ),
      sortByField,
      sortOrder,
    );
  }, [
    query,
    searchResults,
    songDB,
    userData,
    language,
    vocalRange,
    hideCapo,
    onlyFavorites,
    showExternal,
    selectedSongbookIds,
    sortByField,
    sortOrder,
  ]);

  return { songs, bestLocalScore };
}
