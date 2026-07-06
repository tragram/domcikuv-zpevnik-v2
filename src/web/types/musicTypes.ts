type Accidental = "" | "#" | "b";

interface Clonable<T> {
    clone(): T;
}

const SEMITONES_IN_OCTAVE = 12

export class Note implements Clonable<Note> {
    static readonly sharpDictionary = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    static readonly flatDictionary = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    static readonly sharpDictionaryCZ = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "H"];
    static readonly flatDictionaryCZ = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "B", "H"];
    private value: number; // Internal representation: semitone offset (0–11)

    constructor(letter: string, accidental: Accidental = "", czech: boolean = true) {
        const noteIndex = Note.getIndexFromLetter(letter, accidental, czech);
        if (noteIndex === null) {
            throw new Error(`Invalid note: ${letter}${accidental}`);
        }

        this.value = noteIndex;
    }

    static normalizedValue(value: number, steps: number = SEMITONES_IN_OCTAVE): number {
        if (!Number.isInteger(value) || !Number.isInteger(steps)) {
            throw new Error('Note value must be an integer');
        }

        return (value + steps) % SEMITONES_IN_OCTAVE;
    }

    static fromValue(value: number): Note {
        if (!Number.isInteger(value)) {
            throw new Error('Note value must be an integer');
        }
        const note = new Note("C", "");
        Object.defineProperty(note, 'value', {
            value: Note.normalizedValue(value),
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
        const combined = letter + accidental;
        const sharpIndex = selectedSharpDict.indexOf(combined);
        const flatIndex = selectedFlatDict.indexOf(combined);

        const index = sharpIndex !== -1 ? sharpIndex : flatIndex !== -1 ? flatIndex : null;
        if (index === null) {
            // Handle enharmonic equivalents not explicitly in the dictionaries
            if (combined === "E#") return 5;
            if (combined === "B#" && !czech) return 0;
            if (combined === "H#" && czech) return 0;
            if (combined === "Cb") return 11;
            if (combined === "Fb") return 4;
            // In Czech notation, B means Bb. So B# is Bb raised by a semitone = B natural = H (index 11).
            if (combined === "B#" && czech) return 11;
        }

        return index;
    }

    // Converts internal value to a string representation using the specified dictionary
    private static getNoteFromValue(value: number, dictionary: string[]): string {
        const noteIndex = (value % 12 + 12) % 12; // Ensure proper wrapping
        return dictionary[noteIndex];
    }

    // Transpose the note up or down by a given number of semitones
    transpose(semitones: number): void {
        this.value = Note.normalizedValue(this.value, semitones); // Wrap around within 0–11
    }

    transposed(semitones: number): Note {
        return Note.fromValue(Note.normalizedValue(this.value, semitones));
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
        return Note.normalizedValue(higher.getSemitoneValue() - this.value);
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
        readonly note: Note,
        readonly mode: KeyMode = KeyMode.Major
    ) { }

    clone(): Key {
        return new Key(this.note.clone(), this.mode);
    }
    public static parse(text: string | null, czech: boolean = true): Key | undefined {
        if (!text) {
            return undefined;
        }

        const regex = /^(?<note>[A-H](#{1,2}|b{1,2}|x)?)(?<mode>mi|m?)$/;
        const matches = text.trim().match(regex);

        if (!matches?.groups) {
            return undefined;
        }

        const note = Note.parse(matches.groups["note"], czech);
        if (!note) {
            return undefined;
        }
        // Accept both the English "m" and the Czech "mi" minor suffix (the regex
        // captures either); anything starting with "m" is minor.
        const mode = matches.groups["mode"].startsWith("m") ? KeyMode.Minor : KeyMode.Major;
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
        const regexMatch = songRangeStr.replace(/\s+/g, '').match(rangeRegex);
        if (!regexMatch) {
            console.error("Error while parsing song: Invalid song range:", songRangeStr);
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
    
    private static create(
        min: Note | undefined,
        max: Note | undefined,
        semitones: number | undefined,
    ): SongRange {
        const instance: SongRange = Object.create(SongRange.prototype);
        Object.defineProperties(instance, {
            min: { value: min, writable: false },
            max: { value: max, writable: false },
            semitones: { value: semitones, writable: false }
        });
        return instance;
    }

    clone(): SongRange {
        return SongRange.create(this.min?.clone(), this.max?.clone(), this.semitones);
    }

    transposed(semitones: number): SongRange {
        if (semitones == 0) {
            return this;
        }
        return SongRange.create(
            this.min?.transposed(semitones),
            this.max?.transposed(semitones),
            this.semitones,
        );
    }

    toString(transposeSemitones: number = 0, prettyPrint: boolean = false): string {
        if (!(this.min && this.max && this.semitones)) {
            return "";
        }
        const transposedRange = this.transposed(transposeSemitones);
        const octaves = Math.floor(this.semitones / SEMITONES_IN_OCTAVE) + 1;
        const lowerNote = transposedRange.min?.toString().toLowerCase();
        const higherNote = transposedRange.max?.toString().toLowerCase();
        return `${lowerNote}1${prettyPrint ? " - " : "-"}${higherNote}${octaves}`;
    }
}