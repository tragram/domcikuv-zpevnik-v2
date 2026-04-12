import { EditorSubmitSchemaInput } from "src/worker/api/editor";
import z from "zod";
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

export const isValidSongLanguage = (lang?: string): lang is SongLanguage => {
  return lang === undefined || validLanguages.has(lang as SongLanguage);
};

export interface Songbook {
  user: string;
  image: string;
  name: string;
  songIds: Set<string>;
}

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
  SortSettings
};

export type ChordPro = string;

export type EditorState = EditorSubmitSchemaInput;

export const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .refine((val) => val.startsWith("/") && !val.startsWith("//")) // Security check
    .optional()
    .catch(undefined), // Strip out bad URLs seamlessly
});
