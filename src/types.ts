
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

    constructor(song_range_str) {
        if (!song_range_str || !song_range_str.includes("-")) {
            // return <></>
            // song_range_str = "c1-d3"
            this.min = null
            this.max = null
            this.semitones = null;
        } else {
            const song_range = song_range_str.split("-");
            const octaves = song_range[1].slice([-1]) - song_range[0].slice([-1])
            const lowestTone = song_range[0].slice(0, -1).toLowerCase()
            const highestTone = song_range[1].slice(0, -1).toLowerCase()
            const withinOctave = (12 + SongRange.chromaticScale[highestTone] - SongRange.chromaticScale[lowestTone]) % 12

            this.min = song_range[0]
            this.max = song_range[1]
            this.semitones = 12 * octaves + withinOctave;
            // console.log(lowestTone, highestTone, octaves, withinOctave, 12 * octaves + withinOctave)
        }
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

type SongKey = "C" | "C#" | "D" | "Es" | "E" | "F" | "F#" | "G" | "As" | "A" | "B" | "H"

type SongLanguage = "czech" | "english" | "german" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "other"

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

    constructor(song: Object) {
        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
        this.id = unidecode(`${song.artist}-${song.title}`.replace(/ /g, "_"));
        this.key = song.key || null;
        this.dateAdded = {
            year: parseInt(song.date_added.split("-")[1]),
            month: parseInt(song.date_added.split("-")[0])
        };
        this.startMelody = song.startMelody;
        this.language = song.language; // TODO: should parse it properly
        this.tempo = parseInt(song.tempo);
        this.capo = parseInt(song.capo) || 0;
        this.range = new SongRange(song.range);
        this.illustration_author = song.illustration_author || "FLUX.1-dev";
        if (song.pdf_filenames) {
            this.pdfFilenames = JSON.parse(song.pdf_filenames.replace(/'/g, '"')).map(f => import.meta.env.BASE_URL + "/songs/pdfs/" + f);
        } else {
            this.pdfFilenames = [];
        }
        this.chordproFile = song.chordpro_file;
    }

    // Static method to restore an instance from a plain object (after JSON.parse)
    static fromJSON(json: any): SongData {
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

interface LanguageCount {
    [key: SongLanguage]: int
}

export type { SongDB, SortSettings, FilterSettings, SongKey, SongLanguage, LanguageCount, SortOrder, SortField };
export { SongData };

