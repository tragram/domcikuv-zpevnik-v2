import { MusicNote, Key as SongKey } from 'chordproject-parser';
import { Dice1Icon } from 'lucide-react';
type SortOrder = "descending" | "ascending";
type SortField = "title" | "artist" | "dateAdded" | "range"
interface SortSettings {
    order: SortOrder,
    field: SortField
}

type int = number; // dumb TS doesn't have int...

interface FilterSettings {
    language: string,
    vocal_range: "all" | [int, int],
    capo: boolean
}

class Note {
    private static readonly sharpDictionary = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    private static readonly flatDictionary = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    private static readonly sharpDictionaryCZ = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "B", "H"];
    private static readonly flatDictionaryCZ = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "B", "H"];

    private value: number; // Internal representation: semitone offset (0–11)

    constructor(letter: string, accidental: "" | "#" | "b" = "", czech: boolean = true) {
        const noteIndex = Note.getIndexFromLetter(letter, accidental, czech);
        if (noteIndex === null) {
            throw new Error(`Invalid note: ${letter}${accidental}`);
        }

        this.value = noteIndex;
    }

    // Parse a note string (e.g., "C#", "Db", "A") into a Note instance
    static parse(noteString: string, czech: boolean = true): Note | undefined {
        // Match the note string with a regex
        const regex = czech ? new RegExp("^([A-Ha-h])([#b]?)$") : new RegExp("^([A-Ga-g])([#b]?)$")
        const match = regex.exec(noteString);
        if (!match) {
            return undefined;
        }

        const letter = match[1].toUpperCase(); // Normalize to uppercase
        const accidental = match[2] as "" | "#" | "b";

        return new Note(letter, accidental, czech);
    }

    static fromValue(value: number): Note {
        const note = new Note("C");
        note.value = (value + 12) % 12;
        return note;
    }

    // Converts note letter and accidental to an index
    private static getIndexFromLetter(letter: string, accidental: string, czech: boolean): number | null {
        const selectedSharpDict = czech ? Note.sharpDictionaryCZ : Note.sharpDictionary;
        const selectedFlatDict = czech ? Note.flatDictionaryCZ : Note.flatDictionary;
        const sharpIndex = selectedSharpDict.indexOf(letter + accidental);
        const flatIndex = selectedFlatDict.indexOf(letter + accidental);

        return sharpIndex !== -1 ? sharpIndex : flatIndex !== -1 ? flatIndex : null;
    }

    // Converts internal value to a string representation using the specified dictionary
    private static getNoteFromValue(value: number, dictionary: string[]): string {
        const noteIndex = (value % 12 + 12) % 12; // Ensure proper wrapping
        return dictionary[noteIndex];
    }

    // Transpose the note up or down by a given number of semitones
    transpose(semitones: number): void {
        this.value = (this.value + semitones + 12) % 12; // Wrap around within 0–11
    }

    transposed(semitones: number): Note {
        return Note.fromValue((this.value + semitones + 12) % 12);
    }

    clone(): Note {
        return Note.fromValue(this.value);
    }

    // Convert the note to a string representation
    toString(preference: "sharp" | "flat" = "sharp", czech: boolean = true): string {
        let dictionary;
        if (czech) {
            dictionary = preference === "sharp" ? Note.sharpDictionaryCZ : Note.flatDictionaryCZ;
        } else {
            dictionary = preference === "sharp" ? Note.sharpDictionary : Note.flatDictionary;
        }
        return Note.getNoteFromValue(this.value, dictionary);
    }

    // Get the semitone value (useful for debugging or other calculations)
    getSemitoneValue(): number {
        return this.value;
    }

    semitonesBetween(higher: Note) {
        return (higher.getSemitoneValue() - this.value + 12) % 12;
    }
}

export enum KeyMode {
    Major,
    Minor,
}

export class Key {
    note: Note;
    mode: KeyMode;

    // keys that are flat (in Czech)
    private static readonly flatKeys = ["Eb", "F", "Ab", "Dm", "D#", "G#", "Gm", "Fm", "Cm", "Bm", "A#mi"];

    constructor(note: Note, mode: KeyMode = KeyMode.Major) {
        this.note = note;
        this.mode = mode;
    }

    clone(): Key {
        return new Key(this.note.clone(), this.mode);
    }
    public static parse(text: string | null, czech: boolean = true): Key | undefined {
        if (!text) {
            return undefined;
        }

        const regex = /^(?<note>[A-H](#{1,2}|b{1,2}|x)?)(?<mode>m?)$/;
        const matches = text.trim().match(regex);

        if (!matches || !matches.groups) {
            return undefined;
        }

        const note = Note.parse(matches.groups["note"], czech);
        if (note == undefined) {
            return undefined;
        }
        const mode = matches.groups["mode"] === "m" ? KeyMode.Minor : KeyMode.Major;
        return new Key(note, mode);
    }

    public toString(): string {
        return this.note.toString() + (this.mode == KeyMode.Major ? "" : "m");
    }

    public equals(key: Key): boolean {
        return this.toString() == key.toString();
    }

    public isFlat(): boolean {
        return Key.flatKeys.includes(this.toString())
    }

    public transposed(semitones: number): Key {
        return new Key(this.note.transposed(semitones), this.mode);
    }
}

class SongRange {
    min: Note | undefined;
    max: Note | undefined;
    semitones: int | undefined;

    constructor(song_range_str: string) {
        const rangeRegex = new RegExp("([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?-([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?");
        const regexMatch = song_range_str.match(rangeRegex);
        if (!regexMatch) {
            console.log("Error while parsing song: Invalid song range!");
            this.min = undefined;
            this.max = undefined;
            this.semitones = undefined;
            return;
        }
        const [match, lowerTone, lowerToneOctave, lowerToneVoice2, lowerToneVoice2Octave, higherTone, higherToneOctave, higherToneVoice2, higherToneVoice2Octave] = regexMatch;
        this.min = Note.parse(lowerTone);
        this.max = Note.parse(higherTone);
        const notesDefined = this.min && this.max;
        this.semitones = notesDefined ? this.min.semitonesBetween(this.max) + 12 * (parseInt(higherToneOctave) - parseInt(lowerToneOctave)) : undefined;
    }

    static fromJSON(json: any): SongRange {
        const instance = Object.create(SongRange.prototype);
        // Directly assign all fields without running constructor logic
        instance.min = Note.fromValue(json.min.value);
        instance.max = Note.fromValue(json.max.value);
        instance.semitones = json.semitones;
        return instance;
    }

    transposed(semitones: number): SongRange {
        if (semitones == 0) {
            return this;
        }
        return SongRange.fromJSON({
            min: this.min?.transposed(semitones),
            max: this.max?.transposed(semitones),
            semitones: this.semitones,
        });
    }
    toString(transpose_semitones: number) {
        if (!(this.min && this.max && this.semitones)) {
            return "";
        }
        const transposedRange = this.transposed(transpose_semitones);
        const octaves = Math.floor(this.semitones / 12) + 1;
        const lowerNote = transposedRange.min?.toString().toLowerCase();
        const higherNote = transposedRange.max?.toString().toLowerCase();
        return `${lowerNote}1 - ${higherNote}${octaves} `;
    }
}

type SongLanguage = "czech" | "english" | "german" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "other"

interface SongRawData {
    title?: string;
    artist?: string;
    key?: string;
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
    illustration_author: string;
    chordproFile: string;
    pdfFilenames: Array<string>;
    content?: string;
    contentHash: string;

    constructor(song: SongRawData) {
        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
        this.key = Key.parse(song.key, true);
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

        // Directly assign all fields without running constructor logic
        instance.title = json.title;
        instance.artist = json.artist;
        instance.key = json.key ? new Key(Note.fromValue(json.key.note.value), json.key.mode) : null;
        instance.dateAdded = json.dateAdded;
        instance.startMelody = json.startMelody;
        instance.language = json.language;
        instance.tempo = json.tempo;
        instance.capo = json.capo;
        instance.range = SongRange.fromJSON(json.range); // Re-create range object if needed
        instance.illustration_author = json.illustration_author;
        // TODO: isn't this duplicate with the ID?
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

    url(): string {
        return `/song/${this.id}`;
    }

    imageURLFactory(folder: string, model: string | null = null) {
        if (!model) {
            model = this.illustration_author;
        }
        return `${import.meta.env.BASE_URL}/songs/${folder}/${this.id}/${model}.webp`

    }

    thumbnailURL(model: string | null = null): string {
        return this.imageURLFactory("illustrations_thumbnails", model);
    }

    illustrationURL(model: string | null = null): string {
        return this.imageURLFactory("illustrations", model);
    }

    static promptURL(id: string) {
        // for faster async USE
        return `${import.meta.env.BASE_URL}/songs/image_prompts/${id}.yaml`
    }

    promptURL() {
        return `${import.meta.env.BASE_URL}/songs/image_prompts/${this.id}.yaml`
    }
}


interface SongDB {
    maxRange: int,
    languages: LanguageCount, // counts the occurences of each language
    songs: Array<SongData>
}
interface LanguageCount extends Record<SongLanguage, int> { }

export type { SongDB, SortSettings, FilterSettings, SongKey, SongLanguage, LanguageCount, SortOrder, SortField };
export { SongData, Note };

