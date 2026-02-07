import { User } from "better-auth";
import { Note } from "./musicTypes";
import { SongData } from "./songData";
import { Songbook } from "~/services/song-service";
// Import keywords from the source of truth
type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "dateAdded" | "range";
interface SortSettings {
  order: SortOrder;
  field: SortField;
}

type int = number; // dumb TS doesn't have int...

const SONG_LANGUAGES = [
  "all",
  "czech",
  "english",
  "german",
  "icelandic",
  "slovak",
  "polish",
  "spanish",
  "romanian",
  "finnish",
  "estonian",
  "french",
  "italian",
  "portuguese",
  "other",
] as const;

type SongLanguage = (typeof SONG_LANGUAGES)[number];

const validLanguages = new Set(SONG_LANGUAGES);

export const isValidSongLanguage = (lang: string): lang is SongLanguage => {
  return validLanguages.has(lang as SongLanguage);
};

type LanguageCount = Record<SongLanguage, number>;
interface SongDB {
  songs: SongData[];
  songbooks: Songbook[]; // tracks all songbooks defined in the DB
  maxRange?: int;
  languages: LanguageCount; // counts the occurences of each language
}

export { Note };
export type {
  int,
  LanguageCount,
  SongDB,
  SongLanguage,
  SortField,
  SortOrder,
  SortSettings,
};

export interface UserData extends User {
  loggedIn: boolean;
  favorites: Set<string>;
}

export type ChordPro = string;
