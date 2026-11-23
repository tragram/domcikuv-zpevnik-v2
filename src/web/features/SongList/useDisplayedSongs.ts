import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import memoizeOne from "memoize-one";
import { useMemo } from "react";

import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { to_ascii } from "src/lib/song-ids";
import { SongData } from "~/types/songData";
import type { SongDB, SortSettings } from "~/types/types";
import { songbookEntriesQueryOptions, type UserData } from "~/hooks/use-user-data";
import { useQueryStore } from "./searchStore";
import { useSortSettingsStore } from "./Toolbar/SortMenu";
import { applyFilters, sortSongs, type AppliedFilters } from "./Toolbar/filters/songFilters";
import { songsQueryOptions } from "~/hooks/use-songDB";
import { songbookSheet } from "src/lib/song-selection";

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

// Reuse the ordinary browse order across a trip into SongView.
const browseSongs = memoizeOne((
  songs: SongData[],
  songDB: SongDB,
  userData: UserData,
  filters: AppliedFilters,
  sort: SortSettings,
  scopedToSongbook: boolean,
) => sortSongs(
  applyFilters(songs, filters, {
    userData,
    availableSongbooks: songDB.songbooks,
    languageCounts: songDB.languages,
    scopedToSongbook,
  }),
  sort.field,
  sort.order,
));

export function useDisplayedSongs(
  songDB: SongDB,
  userData: UserData,
): DisplayedSongs {
  const sort = useSortSettingsStore();
  const query = useQueryStore((state) => state.query);
  const filters = useFilterSettingsStore();
  const { selectedSongbookId } = filters;

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
  // Observe the catalog already downloaded by useSongDB; never fetch here.
  // songDB.songs contains the viewer's pins, which aren't this owner's choices.
  const { data: officialSongs } = useQuery({ ...songsQueryOptions(), enabled: false });
  // Resolve each entry to a SongData: pinned drafts ship inline as `e.song`;
  // canonical entries are looked up in the raw catalog (the payload omits them
  // to stay small). Entries that resolve to neither (deleted) are dropped.
  const ownerSongs = useMemo(() => {
    if (!foreignOwner) return undefined;
    const toSong = (sheet: NonNullable<ReturnType<typeof songbookSheet>>) =>
      new SongData({ ...sheet, isFavoriteByCurrentUser: userData?.favoriteIds.has(sheet.id) });
    if (!ownerEntries) return (officialSongs ?? []).map(toSong);
    const byId = new Map(officialSongs?.map((s) => [s.id, s]));
    return ownerEntries
      .flatMap((entry) => {
        const sheet = songbookSheet(byId.get(entry.songId), entry);
        return sheet ? [toSong(sheet)] : [];
      });
  }, [foreignOwner, ownerEntries, officialSongs, userData?.favoriteIds]);
  // Until the owner's songbook loads, fall back to the global list (filtered by
  // songbook below shows its approved subset), then swap to the full set.
  const baseSongs = foreignOwner && ownerSongs ? ownerSongs : songDB.songs;

  const fuse = useMemo(() => new Fuse(baseSongs, {
    includeScore: true,
    keys: ["title_for_search", "artist_for_search"],
    ignoreLocation: true,
    threshold: 0.4,
  }), [baseSongs]);

  // Search includes published songs awaiting an official selection.
  const results = useMemo(() => {
    if (!query) return null;
    const matches = fuse.search(to_ascii(query).toLowerCase());
    return {
      songs: matches.map((match) => match.item),
      bestLocalScore: matches[0]?.score ?? Infinity,
    };
  }, [fuse, query]);

  return {
    songs: results?.songs ?? browseSongs(baseSongs, songDB, userData, filters, sort, !!foreignOwner && !!ownerEntries),
    bestLocalScore: results?.bestLocalScore ?? Infinity,
    foreignSongbookOwner: foreignOwner,
  };
}
