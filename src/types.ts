
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

