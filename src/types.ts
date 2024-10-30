
import unidecode from 'unidecode'
type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "dateAdded" | "range"
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


class SongRange {
    // TODO: tohle by se taky asi melo predelat na anglickou variantu, ne?
    static chromaticScale = {
        "c": 0,
        "c#": 1,
        "db": 1,
        "d": 2,
        "d#": 3,
        "eb": 3,
        "e": 4,
        "f": 5,
        "f#": 6,
        "gb": 6,
        "g": 7,
        "g#": 8,
        "ab": 8,
        "a": 9,
        "a#": 10,
        "bb": 10,
        "b": 11,
        "h": 11
    };
    min: string;
    max: string;
    semitones: int;

    constructor(song_range_str: string) {
        if (!song_range_str || !song_range_str.includes("-")) {
            this.min = null;
            this.max = null;
            this.semitones = null;
            return; // Exit early to reduce nesting
        }

        let [minRange, maxRange] = song_range_str.split("-");
        // songs with multiple voices may be written as e.g. e1/g1-e2/c3 --> just take the base voice
        minRange = minRange.split("/")[0]
        maxRange = maxRange.split("/")[0]
        const lowestTone = minRange.slice(0, -1).toLowerCase();
        const highestTone = maxRange.slice(0, -1).toLowerCase();
        const octaves = parseInt(maxRange.slice(-1)) - parseInt(minRange.slice(-1));
        const withinOctave = (12 + SongRange.chromaticScale[highestTone] - SongRange.chromaticScale[lowestTone]) % 12;

        this.min = minRange;
        this.max = maxRange;
        this.semitones = 12 * octaves + withinOctave;
    }

    static fromJSON(json: any): SongData {
        const instance = Object.create(SongData.prototype);

        // Directly assign all fields without running constructor logic
        instance.min = json.min;
        instance.max = json.max;
        instance.semitones = json.semitones;
        return instance;
    }

}

// TODO: už se používají anglické...
type SongKey = "C" | "C#" | "D" | "Es" | "E" | "F" | "F#" | "G" | "As" | "A" | "B" | "H"

type SongLanguage = "czech" | "english" | "german" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "other"

interface SongRawData {
    title?: string;
    artist?: string;
    key?: SongKey;
    date_added: string;
    startMelody?: string;
    language?: SongLanguage;
    tempo?: string | number;
    capo?: string | number;
    range?: string;
    illustration_author?: string;
    pdf_filenames?: string;
    chordpro_file?: string;
    content_hash?: string;
}

class SongData {
    id: string;
    title: string;
    artist: string;
    key: SongKey;
    dateAdded: {
        month: int;
        year: int;
    };
    startMelody: string;
    language: SongLanguage;
    tempo: int;
    capo: int;
    range: SongRange;
    illustration_author: string;
    chordproFile: string;
    pdfFilenames: Array<string>;
    content: string | null;
    contentHash: string;

    constructor(song: SongRawData) {
        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
        this.id = unidecode(`${this.artist}-${this.title}`.replace(/ /g, "_")).replace("?", "");
        this.key = song.key || null;

        const [month, year] = song.date_added.split("-");
        this.dateAdded = { month: parseInt(month), year: parseInt(year) };

        this.startMelody = song.startMelody;
        this.language = song.language || "other";
        this.tempo = parseInt(song.tempo as string);
        this.capo = parseInt(song.capo as string) || 0;
        this.range = new SongRange(song.range || "");
        this.illustration_author = song.illustration_author || "FLUX.1-dev";

        this.pdfFilenames = song.pdf_filenames
            ? JSON.parse(song.pdf_filenames.replace(/'/g, '"')).map(f => import.meta.env.BASE_URL + "/songs/pdfs/" + f)
            : [];

        this.chordproFile = song.chordpro_file || "";
        this.contentHash = song.content_hash || "";
    }

    // Static method to restore an instance from a plain object (after JSON.parse)
    static fromJSON(json: Partial<SongData>): SongData {
        const instance = Object.create(SongData.prototype);

        // Directly assign all fields without running constructor logic
        instance.title = json.title;
        instance.artist = json.artist;
        instance.id = json.id;
        instance.key = json.key;
        instance.dateAdded = json.dateAdded;
        instance.startMelody = json.startMelody;
        instance.language = json.language;
        instance.tempo = json.tempo;
        instance.capo = json.capo;
        instance.range = SongRange.fromJSON(json.range); // Re-create range object if needed
        instance.illustration_author = json.illustration_author
        instance.chordproFile = json.chordproFile;
        instance.pdfFilenames = json.pdfFilenames;
        instance.content = json.content;
        instance.contentHash = json.contentHash;

        return instance;
    }

    lyricsLength(): int {
        if (!this.content) {
            return 0;
        }
        // remove chordpro directives
        let lyricsOnly = this.content.replace(/\{.*?\}/g, "");
        // remove chords (e.g., [C], [Am], etc.)
        lyricsOnly = lyricsOnly.replace(/\[.*?\]/g, "");
        // remove extra whitespace (e.g., multiple spaces, newlines)
        lyricsOnly = lyricsOnly.replace(/\s+/g, " ").trim();
        return lyricsOnly.length;
    }
}


interface SongDB {
    maxRange: int,
    languages: LanguageCount, // counts the occurences of each language
    songs: Array<SongData>
}
interface LanguageCount extends Record<SongLanguage, int> { }

export type { SongDB, SortSettings, FilterSettings, SongKey, SongLanguage, LanguageCount, SortOrder, SortField };
export { SongData };

