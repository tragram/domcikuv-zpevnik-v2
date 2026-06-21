import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useEffect, useMemo } from "react";

import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { SongData, to_ascii } from "~/types/songData";
import type { SongDB } from "~/types/types";
import { songbookEntriesQueryOptions, type UserData } from "~/hooks/use-user-data";
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
  /**
   * The other user whose songbook the list is scoped to (single-select of a
   * foreign songbook), else undefined. Drives both the base list here and the
   * `?songbook=` link param on each row, so the two can never drift apart.
   */
  foreignSongbookOwner?: string;
}

export function useDisplayedSongs(
  songDB: SongDB,
  userData: UserData,
): DisplayedSongs {
  const { field: sortByField, order: sortOrder } = useSortSettingsStore();
  const { query, setQuery } = useQueryStore();
  const { language, vocalRange, hideCapo, onlyFavorites, showExternal, selectedSongbookId } =
    useFilterSettingsStore();

  // Changing the sort clears an active search: search ignores sort entirely, so
  // this stops the two from implying contradictory orderings.
  useEffect(() => {
    setQuery("");
  }, [sortByField, sortOrder, setQuery]);

  // When the list is narrowed to a single *other* user's songbook, fetch that
  // songbook's contents on demand and use it as the base list — including the
  // owner's pending songs that aren't in the global SongDB. Kept fully isolated:
  // these songs never enter `songDB`, so they can't leak into anyone's browse.
  const foreignOwner =
    selectedSongbookId && selectedSongbookId !== userData?.profile.id
      ? selectedSongbookId
      : undefined;
  const { data: ownerEntries } = useQuery({
    ...songbookEntriesQueryOptions(foreignOwner ?? ""),
    enabled: !!foreignOwner,
  });
  // Resolve each entry to a SongData: pinned drafts ship inline as `e.song`;
  // canonical entries are looked up in the global SongDB (the payload omits them
  // to stay small). Entries that resolve to neither (deleted) are dropped.
  const ownerSongs = useMemo(() => {
    if (!ownerEntries) return undefined;
    const byId = new Map(songDB.songs.map((s) => [s.id, s]));
    return ownerEntries
      .map((e) => (e.song ? new SongData(e.song) : byId.get(e.songId)))
      .filter((s): s is SongData => !!s);
  }, [ownerEntries, songDB.songs]);
  // Until the owner's songbook loads, fall back to the global list (filtered by
  // songbook below shows its approved subset), then swap to the full set.
  const baseSongs = foreignOwner && ownerSongs ? ownerSongs : songDB.songs;

  const fuse = useMemo(
    () =>
      new Fuse(baseSongs, {
        includeScore: true,
        keys: ["title_for_search", "artist_for_search"],
        ignoreLocation: true,
        threshold: 0.4,
      }),
    [baseSongs],
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
    // setting (capo, language, favorites, songbooks, show-external) plus the
    // hidden-song filter. Search spans the whole local library — so it is the
    // only way to reach songs the browse list hides: external-origin songs (for
    // logged-out users) and admin-hidden songs (for everyone).
    if (query && searchResults) {
      return searchResults.map((r) => r.item);
    }
    // BROWSE MODE: filter, then sort. For a foreign songbook the base is already
    // that songbook's songs (the songbook filter below is then a harmless no-op).
    return sortSongs(
      applyFilters(
        baseSongs,
        { language, vocalRange, hideCapo, onlyFavorites, showExternal, selectedSongbookId },
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
    baseSongs,
    songDB,
    userData,
    language,
    vocalRange,
    hideCapo,
    onlyFavorites,
    showExternal,
    selectedSongbookId,
    sortByField,
    sortOrder,
  ]);

  return { songs, bestLocalScore, foreignSongbookOwner: foreignOwner };
}
