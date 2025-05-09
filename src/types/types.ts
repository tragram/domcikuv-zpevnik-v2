import { fileURL } from "../components/song_loader";
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

type SongLanguage = "all" | "czech" | "english" | "german" | "icelandic" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "russian" | "other"

class IllustrationData {
    prompt_id: string;
    prompt_model: string;
    image_model: string;
    available_illustrations: string[];

    constructor(prompt_model: string | undefined, prompt_id: string | undefined, image_model: string | undefined,
        available_illustrations: string[] | undefined) {
        this.prompt_model = prompt_model || "gpt-4o-mini";
        this.prompt_id = prompt_id || "v2";
        this.image_model = image_model || "FLUX.1-dev";
        this.available_illustrations = available_illustrations || [];
    }

    preferredFilenameStem(): string {
        if (this.available_illustrations.length == 0) {
            console.log("Warning: Missing image")
            return "";
        }
        const preferredFilenameStem = this.toFilenameStem();
        if (this.available_illustrations.includes(preferredFilenameStem)) {
            return preferredFilenameStem;
        } else {
            // select closest image with criteria image_model > prompt_id > prompt_model
            const filters = [this.image_model, this.prompt_id, this.prompt_model]
            let old_results = this.available_illustrations;
            filters.forEach(f => {
                const new_results = this.available_illustrations.filter(il => il.includes(f));
                if (new_results.length > 0) {
                    old_results = new_results;
                } else {
                    return old_results[0];
                }

            })
            return old_results[0];
        }
    }

    toFilenameStem(prompt_model?: string, prompt_id?: string, image_model?: string): string {
        return IllustrationData.toFilenameStemFactory(prompt_model || this.prompt_model, prompt_id || this.prompt_id, image_model || this.image_model)
    }

    static toFilenameStemFactory(prompt_model: string, prompt_id: string, image_model: string): string {
        return prompt_model + "_" + prompt_id + "_" + image_model
    }

    static fromJSON(json: any): IllustrationData {
        const instance = new IllustrationData(json.prompt_model, json.prompt_id, json.image_model, json.available_illustrations)
        return instance;
    }

}

interface SongRawData {
    title?: string;
    artist?: string;
    key?: string;
    dateAdded?: string;
    songbooks?: string;
    startMelody?: string;
    language?: SongLanguage;
    tempo?: string | number;
    capo?: string | number;
    range?: string;
    illustrationAuthor?: string;
    pdfFilenames?: string;
    chordproFile?: string;
    contentHash?: string;
    prompt_model?: string;
    prompt_id?: string;
    image_model?: string;
    illustrations?: string[];
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
    songbooks: string[];
    language: SongLanguage;
    tempo: int;
    capo: int;
    range: SongRange;
    illustrationData: IllustrationData;
    chordproFile: string;
    pdfFilenames: Array<string>;
    content?: string;
    contentHash: string;

    constructor(song: SongRawData) {
        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
        this.key = SongData.parseKey(song.key);
        this.dateAdded = SongData.parseDateAdded(song.dateAdded);
        this.songbooks = SongData.parseSongbooks(song.songbooks, this.artist, this.title);
        this.startMelody = song.startMelody;
        this.language = song.language || "other";
        this.tempo = SongData.parseTempo(song.tempo);
        this.capo = SongData.parseCapo(song.capo);
        this.range = SongData.parseRange(song.range);
        this.illustrationData = SongData.parseIllustrationData(song);
        this.pdfFilenames = SongData.parsePdfFilenames(song.pdfFilenames, this.artist, this.title);
        this.chordproFile = song.chordproFile || "";
        this.contentHash = song.contentHash || "";
    }

    static parseKey(key?: string) {
        return Key.parse(key || null, true);
    }

    static parseDateAdded(dateAdded?: string) {
        const [month, year] = (dateAdded || "0-12").split("-");
        return { month: parseInt(month), year: parseInt(year) };
    }

    static parseSongbooks(songbooks?: string, artist?: string, title?: string): string[] {
        try {
            return songbooks ? JSON.parse(songbooks) : [];
        } catch (error) {
            console.log(`Error parsing songbooks for "${artist}: ${title}"`, error);
            return [];
        }
    }

    static parseTempo(tempo?: string | number): int {
        return parseInt(tempo as string) || 0;
    }

    static parseCapo(capo?: string | number): int {
        return parseInt(capo as string) || 0;
    }

    static parseRange(range?: string): SongRange {
        return new SongRange(range || "");
    }

    static parseIllustrationData(song: SongRawData): IllustrationData {
        return new IllustrationData(song.prompt_model, song.prompt_id, song.image_model, song.illustrations);
    }

    static parsePdfFilenames(pdfFilenames?: string, artist?: string, title?: string): Array<string> {
        try {
            return pdfFilenames
                ? JSON.parse(pdfFilenames).map((f: string) => fileURL("songs/pdfs/" + f))
                : [];
        } catch (error) {
            console.log(`Error parsing pdf filenames for "${artist}: ${title}"`, error);
            return [];
        }
    }

    static to_ascii(text: string) {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    get ascii_title() {
        return SongData.to_ascii(this.title);
    }

    get ascii_artist() {
        return SongData.to_ascii(this.artist);
    }

    get id() {
        return `${this.ascii_artist}-${this.ascii_title}`
            .replace(/ /g, "_")
            .replace(/[^A-Za-z0-9-_]+/g, "")
            .replace(/_+/g, "_");
    }

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
        if (json.illustrationData) {
            instance.illustrationData = IllustrationData.fromJSON(instance.illustrationData);
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

    private imageURLFactory(folder: string, prompt_model?: string, prompt_id?: string, image_model?: string): string {
        const stem = prompt_model || prompt_id || image_model
            ? this.illustrationData.toFilenameStem(prompt_model, prompt_id, image_model)
            : this.illustrationData.preferredFilenameStem();
        return fileURL(`songs/${folder}/${this.id}/${stem}.webp`);
    }

    thumbnailURL(prompt_model?: string, prompt_id?: string, image_model?: string): string {
        return this.imageURLFactory("illustrations_thumbnails", prompt_model, prompt_id, image_model);
    }

    illustrationURL(prompt_model?: string, prompt_id?: string, image_model?: string): string {
        return this.imageURLFactory("illustrations", prompt_model, prompt_id, image_model);
    }

    static promptURL(id: string) {
        return fileURL(`songs/image_prompts/${id}.yaml`);
    }

    promptURL() {
        return fileURL(`songs/image_prompts/${this.id}.yaml`);
    }
}


type LanguageCount = Record<SongLanguage, number>
interface SongDB {
    maxRange: int,
    languages: LanguageCount, // counts the occurences of each language
    songs: Array<SongData>
    songbooks: string[]; // tracks all songbooks defined in the DB
}

export type { SongDB, SortSettings, FilterSettings, SongLanguage, LanguageCount, SortOrder, SortField };
export { SongData, Note };

