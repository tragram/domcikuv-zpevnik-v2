
type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "date_added" | "range"
interface SortSettings {
    order: SortOrder,
    field: SortField
}

type int = number; // dumb JS doesn't have int...

interface FilterSettings {
    language: string,
    vocal_range: "all" | [int, int],
    capo: boolean
}

type SongKey = "C" | "C#" | "D" | "Es" | "E" | "F" | "F#" | "G" | "As" | "A" | "B" | "H"
interface SongData {
    title: string,
    artist: string,
    key: SongKey,
    date_added: {
        month: int,
        year: int,
    },
    start_melody: string,
    language: string,
    tempo: int,
    capo: int,
    range: string,
    content: string,
}