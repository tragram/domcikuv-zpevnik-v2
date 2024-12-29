import { fileURL } from "./components/song_loader";
import { Key, Note, SongRange } from "./musicTypes";

type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "dateAdded" | "range"
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


type SongLanguage = "czech" | "english" | "german" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "other"

interface SongRawData {
    title?: string;
    artist?: string;
    key?: string;
    dateAdded: string;
    startMelody?: string;
    language?: SongLanguage;
    tempo?: string | number;
    capo?: string | number;
    range?: string;
    illustrationAuthor?: string;
    pdfFilenames?: string;
    chordproFile?: string;
    contentHash?: string;
}

class SongData {
    title: string;
    artist: string;
    key?: Key;
    dateAdded: {
        month: int;
        year: int;
    };
    startMelody?: string;
    language: SongLanguage;
    tempo: int;
    capo: int;
    range: SongRange;
    illustrationAuthor: string;
    chordproFile: string;
    pdfFilenames: Array<string>;
    content?: string;
    contentHash: string;

    constructor(song: SongRawData) {
        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
        this.key = Key.parse(song.key || null, true);
        const [month, year] = song.dateAdded.split("-");
        this.dateAdded = { month: parseInt(month), year: parseInt(year) };

        this.startMelody = song.startMelody;
        this.language = song.language || "other";
        this.tempo = parseInt(song.tempo as string);
        this.capo = parseInt(song.capo as string) || 0;
        this.range = new SongRange(song.range || "");
        this.illustrationAuthor = song.illustrationAuthor || "FLUX.1-dev";
        this.pdfFilenames = song.pdfFilenames
            ? JSON.parse(song.pdfFilenames.replace(/'/g, '"')).map((f: string) => fileURL("songs/pdfs/" + f))
            : [];

        this.chordproFile = song.chordproFile || "";
        this.contentHash = song.contentHash || "";
    }

    static to_ascii(text: string) {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }

    get ascii_title() {
        return SongData.to_ascii(this.title)
    }

    get ascii_artist() {
        return SongData.to_ascii(this.artist)
    }

    get id() {
        return `${this.ascii_artist}-${this.ascii_title}`.replace(/ /g, "_").replace("?", "").replace("/", "");
    }

    // Static method to restore an instance from a plain object (after JSON.parse)
    static fromJSON(json: Partial<SongData>): SongData {
        const instance = Object.create(SongData.prototype);
        Object.assign(instance, json);
        if (json.key) {
            instance.key = new Key(
                Note.fromValue(json.key.note.value),
                json.key.mode
            );
        }
        if (json.range) {
            instance.range = SongRange.fromJSON(instance.range);
        }
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

    url(): string {
        return `/song/${this.id}`;
    }


    private imageURLFactory(folder: string, model: string | null = null): string {
        model = model || this.illustrationAuthor;
        return fileURL(`songs/${folder}/${this.id}/${model}.webp`);
    }

    thumbnailURL(model: string | null = null): string {
        return this.imageURLFactory("illustrations_thumbnails", model);
    }

    illustrationURL(model: string | null = null): string {
        return this.imageURLFactory("illustrations", model);
    }

    static promptURL(id: string) {
        // for faster async USE
        return fileURL(`songs/image_prompts/${id}.yaml`)
    }

    promptURL() {
        return fileURL(`songs/image_prompts/${this.id}.yaml`)
    }
}


interface SongDB {
    maxRange: int,
    languages: LanguageCount, // counts the occurences of each language
    songs: Array<SongData>
}
interface LanguageCount extends Record<SongLanguage, int> { }

export type { SongDB, SortSettings, FilterSettings, SongLanguage, LanguageCount, SortOrder, SortField };
export { SongData, Note };

