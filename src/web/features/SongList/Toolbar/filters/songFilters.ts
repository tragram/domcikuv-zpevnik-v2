import type { SongData } from "~/types/songData";
import type { UserData } from "~/hooks/use-user-data";
import { isValidSongLanguage } from "~/types/types";
import type {
  LanguageCount,
  Songbook,
  SortField,
  SortOrder,
} from "~/types/types";
import type { FilterSettings, VocalRangeType } from "./Filters";
import { RARE_LANGUAGE_THRESHOLD } from "./LanguageFilter";

// --- Individual filters ---------------------------------------------------

export const filterLanguage = (
  songs: SongData[],
  selectedLanguage: string,
  languageCounts: LanguageCount,
): SongData[] => {
  if (selectedLanguage === "all") {
    return songs;
  }
  if (selectedLanguage === "other") {
    return songs.filter((song) => {
      // "Other" is the catch-all for songs without their own (common) language
      // entry. Unknown/invalid languages are bucketed as "other" in buildSongDB,
      // so they don't appear under their own key in languageCounts — treat them
      // as "other" here too rather than looking them up (and missing).
      if (!isValidSongLanguage(song.language)) return true;
      const lang = song.language ?? "other";
      return (languageCounts[lang] ?? 0) < RARE_LANGUAGE_THRESHOLD;
    });
  }
  return songs.filter((song) => song.language === selectedLanguage);
};

export const filterFavorites = (
  songs: SongData[],
  loggedIn: boolean,
  onlyFavorites: boolean,
): SongData[] => {
  if (loggedIn && onlyFavorites) {
    return songs.filter((song) => song.isFavorite);
  }
  return songs;
};

export const filterCapo = (songs: SongData[], hideCapo: boolean): SongData[] => {
  if (!hideCapo) {
    return songs;
  }
  return songs.filter((song) => song.capo === 0 || song.capo === undefined);
};

export const filterVocalRange = (
  songs: SongData[],
  vocalRange: VocalRangeType,
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

/**
 * Keeps songs that belong to the selected songbook. Selection is by songbook
 * owner id, resolved against the live `availableSongbooks` here (rather than
 * stored as a full object), so a stale selection is simply ignored.
 */
export const filterSongbook = (
  songs: SongData[],
  availableSongbooks: Songbook[],
  selectedSongbookId: string | null,
): SongData[] => {
  if (!selectedSongbookId) return songs;
  const songbook = availableSongbooks.find((s) => s.user === selectedSongbookId);
  if (!songbook) return songs;
  const songIds = songbook.songIds;
  return songs.filter((song) => songIds.has(song.id));
};

export const filterExternal = (
  songs: SongData[],
  loggedIn: boolean,
  showExternal: boolean,
): SongData[] => {
  if (!loggedIn || !showExternal) {
    return songs.filter((song) => !song.externalSource);
  }
  return songs;
};

/**
 * Hidden songs are excluded from the browse list, except the current user's own
 * favorites (so self-curated hidden songs stay in their songbook). Being an admin
 * grants no special pass — broad hidden-song management is the dashboard's job.
 * Search bypasses the whole filter pipeline, so hidden songs remain findable there.
 */
export const filterHidden = (songs: SongData[]): SongData[] =>
  songs.filter((song) => !song.hidden || song.isFavorite);

// --- Composed pipeline ----------------------------------------------------

export type AppliedFilters = FilterSettings & {
  selectedSongbookId: string | null;
};

export interface FilterContext {
  userData: UserData;
  availableSongbooks: Songbook[];
  /** Needed only to resolve the "other" (rare) language bucket. */
  languageCounts?: LanguageCount;
}

/**
 * Single source of truth for the filter pipeline, shared by the song list and
 * the random-song picker. Each filter is independent, so ordering is irrelevant.
 */
export const applyFilters = (
  songs: SongData[],
  filters: AppliedFilters,
  ctx: FilterContext,
): SongData[] => {
  const loggedIn = !!ctx.userData;
  let result = filterHidden(songs);
  result = filterCapo(result, filters.hideCapo);
  result = filterVocalRange(result, filters.vocalRange);
  if (ctx.languageCounts) {
    result = filterLanguage(result, filters.language, ctx.languageCounts);
  }
  result = filterFavorites(result, loggedIn, filters.onlyFavorites);
  result = filterExternal(result, loggedIn, filters.showExternal);
  result = filterSongbook(result, ctx.availableSongbooks, filters.selectedSongbookId);
  return result;
};

// --- Sorting --------------------------------------------------------------

const getSortCompareFunction =
  (sortByField: SortField, sortOrder: SortOrder) =>
  (a: SongData, b: SongData): number => {
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

export const sortSongs = (
  songs: SongData[],
  field: SortField,
  order: SortOrder,
): SongData[] => songs.toSorted(getSortCompareFunction(field, order));
