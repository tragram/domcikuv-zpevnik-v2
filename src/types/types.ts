
import { Note } from "./musicTypes";
import { SongData } from "./songData";
// Import keywords from the source of truth
type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "dateAdded" | "range";
interface SortSettings {
    order: SortOrder,
    field: SortField
}

type int = number; // dumb TS doesn't have int...

interface FilterSettings {
    language: string,
    vocalRange: "all" | [int, int],
    capo: boolean
}

type SongLanguage = "all" | "czech" | "english" | "german" | "icelandic" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "russian" | "other"


type LanguageCount = Record<SongLanguage, number>
interface SongDB {
    maxRange: int,
    languages: LanguageCount, // counts the occurences of each language
    songs: Array<SongData>
    songbooks: string[]; // tracks all songbooks defined in the DB
}

export { Note };
export type { FilterSettings, LanguageCount, SongDB, SongLanguage, SortField, SortOrder, SortSettings, int };
