type Accidental = "" | "#" | "b";

interface Clonable<T> {
    clone(): T;
}

const SEMITONES_IN_OCTAVE = 12

export class Note implements Clonable<Note> {
    private static readonly sharpDictionary = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    private static readonly flatDictionary = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    private static readonly sharpDictionaryCZ = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
    private static readonly flatDictionaryCZ = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "B", "H"];
    private value: number; // Internal representation: semitone offset (0–11)

    constructor(letter: string, accidental: Accidental, czech: boolean = true) {
        const noteIndex = Note.getIndexFromLetter(letter, accidental, czech);
        if (noteIndex === null) {
            throw new Error(`Invalid note: ${letter}${accidental}`);
        }

        this.value = noteIndex;
    }

    static fromValue(value: number): Note {
        if (!Number.isInteger(value)) {
            throw new Error('Note value must be an integer');
        }
        const normalizedValue = (value + SEMITONES_IN_OCTAVE) % SEMITONES_IN_OCTAVE;
        const note = new Note("C", "");
        Object.defineProperty(note, 'value', {
            value: normalizedValue,
            writable: false
        });
        return note;
    }

    // Parse a note string (e.g., "C#", "Db", "A") into a Note instance
    static parse(noteString: string, czech: boolean = true): Note | undefined {
        // Match the note string with a regex
        const regex = czech ? /^([A-Ha-h])([#b]?)$/ : /^([A-Ga-g])([#b]?)$/;
        const match = regex.exec(noteString);
        if (!match) {
            return undefined;
        }

        const letter = match[1].toUpperCase(); // Normalize to uppercase
        const accidental = (match[2] || "") as Accidental;
        return new Note(letter, accidental, czech);
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

export class Key implements Clonable<Key> {
    // keys that are flat (in Czech)
    private static readonly flatKeys: Set<string> = new Set([
        "Eb", "F", "Ab", "Dm", "D#", "G#", "Gm", "Fm", "Cm", "Bm", "A#mi"
    ]);

    constructor(
        private readonly note: Note,
        private readonly mode: KeyMode = KeyMode.Major
    ) { }

    clone(): Key {
        return new Key(this.note.clone(), this.mode);
    }
    public static parse(text: string | null, czech: boolean = true): Key | undefined {
        if (!text) {
            return undefined;
        }

        const regex = /^(?<note>[A-H](#{1,2}|b{1,2}|x)?)(?<mode>m?)$/;
        const matches = text.trim().match(regex);

        if (!matches?.groups) {
            return undefined;
        }

        const note = Note.parse(matches.groups["note"], czech);
        if (!note) {
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
        return Key.flatKeys.has(this.toString());
    }

    public transposed(semitones: number): Key {
        return new Key(this.note.transposed(semitones), this.mode);
    }
}

export class SongRange {
    min: Note | undefined;
    max: Note | undefined;
    semitones: number | undefined;

    constructor(songRangeStr: string) {
        const rangeRegex = new RegExp("([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?-([A-Ha-h][#b]{0,2})([1-9])(?:/([A-Ha-h][#b]{0,2})([1-9]))?");
        const regexMatch = songRangeStr.match(rangeRegex);
        if (!regexMatch) {
            console.log("Error while parsing song: Invalid song range:", songRangeStr);
            return;
        }
        const [match, lowerTone, lowerToneOctave, lowerToneVoice2, lowerToneVoice2Octave, higherTone, higherToneOctave, higherToneVoice2, higherToneVoice2Octave] = regexMatch;
        this.min = Note.parse(lowerTone);
        this.max = Note.parse(higherTone);
        if (this.min && this.max) {
            this.semitones = this.min.semitonesBetween(this.max) + 12 * (parseInt(higherToneOctave) - parseInt(lowerToneOctave))
        } else {
            this.semitones = undefined;
        }
    }

    static fromJSON(json: any): SongRange {
        const instance = Object.create(SongRange.prototype);
        Object.defineProperties(instance, {
            min: { value: json.min ? Note.fromValue(json.min.value) : undefined, writable: false },
            max: { value: json.max ? Note.fromValue(json.max.value) : undefined, writable: false },
            semitones: { value: json.semitones, writable: false }
        });
        return instance;
    }


    clone(): SongRange {
        return SongRange.fromJSON({
            min: this.min,
            max: this.max,
            semitones: this.semitones
        });
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

    toString(transposeSemitones: number = 0): string {
        if (!(this.min && this.max && this.semitones)) {
            return "";
        }
        const transposedRange = this.transposed(transposeSemitones);
        const octaves = Math.floor(this.semitones / SEMITONES_IN_OCTAVE) + 1;
        const lowerNote = transposedRange.min?.toString().toLowerCase();
        const higherNote = transposedRange.max?.toString().toLowerCase();
        return `${lowerNote}1 - ${higherNote}${octaves} `;
    }
}