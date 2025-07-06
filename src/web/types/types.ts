import { User } from "better-auth";
import { Note } from "./musicTypes";
import { SongData } from "./songData";
// Import keywords from the source of truth
type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "dateAdded" | "range";
interface SortSettings {
  order: SortOrder;
  field: SortField;
}

type int = number; // dumb TS doesn't have int...

type SongLanguage =
  | "all"
  | "czech"
  | "english"
  | "german"
  | "icelandic"
  | "slovak"
  | "polish"
  | "spanish"
  | "romanian"
  | "finnish"
  | "estonian"
  | "french"
  | "italian"
  | "portuguese"
  | "russian"
  | "other";

type LanguageCount = Record<SongLanguage, number>;
interface SongDB {
  maxRange: int;
  languages: LanguageCount; // counts the occurences of each language
  songs: Array<SongData>;
  songbooks: string[]; // tracks all songbooks defined in the DB
}

export const songDBFromJSON = (songDBJSON) => {
  return {
    ...songDBJSON,
    songs: songDBJSON.songs.map((s) => SongData.fromJSON(s)),
  };
};

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

export interface Songbook {
  user: string;
  image: string;
  name: string;
  songIds: string[];
}
