
import { preambleKeywords, generatedFields, chordpro2JSKeywords, JS2chordproKeywords } from "./preambleKeywords";
import { fileURL } from "../components/song_loader";
import { Key, Note, SongRange } from "./musicTypes";
import { int, SongLanguage } from "./types";

class IllustrationData {
    promptId: string;
    promptModel: string;
    imageModel: string;
    availableIllustrations: string[];

    constructor(promptModel: string | undefined, promptId: string | undefined, imageModel: string | undefined,
        availableIllustrations: string[] | undefined) {
        this.promptModel = promptModel || "gpt-4o-mini";
        this.promptId = promptId || "v2";
        this.imageModel = imageModel || "FLUX.1-dev";
        this.availableIllustrations = availableIllustrations || [];
    }

    preferredFilenameStem(): string {
        if (this.availableIllustrations.length == 0) {
            console.log("Warning: Missing image")
            return "";
        }
        const preferredFilenameStem = this.toFilenameStem();
        if (this.availableIllustrations.includes(preferredFilenameStem)) {
            return preferredFilenameStem;
        } else {
            // select closest image with criteria imageModel > promptId > promptModel
            const filters = [this.imageModel, this.promptId, this.promptModel]
            let oldResults = this.availableIllustrations;
            filters.forEach(f => {
                const newResults = this.availableIllustrations.filter(il => il.includes(f));
                if (newResults.length > 0) {
                    oldResults = newResults;
                } else {
                    return oldResults[0];
                }

            })
            return oldResults[0];
        }
    }

    toFilenameStem(promptModel?: string, promptId?: string, imageModel?: string): string {
        return IllustrationData.toFilenameStemFactory(promptModel || this.promptModel, promptId || this.promptId, imageModel || this.imageModel)
    }

    static toFilenameStemFactory(promptModel: string, promptId: string, imageModel: string): string {
        return promptModel + "_" + promptId + "_" + imageModel
    }

    static fromJSON(json: any): IllustrationData {
        const instance = new IllustrationData(json.promptModel, json.promptId, json.imageModel, json.availableIllustrations)
        return instance;
    }
    reconstructPreamble(): Record<string, string> {
        return {
            promptId: this.promptId,
            promptModel: this.promptModel,
            imageModel: this.imageModel
        };
    }
}

interface SongMetadata {
    // File-based fields from preambleKeywords
    title?: string;
    artist?: string;
    key?: string;
    dateAdded?: string;
    songbooks?: string;
    startMelody?: string;
    language?: string;
    tempo?: string;
    capo?: string;
    range?: string;
    pdfFilenames?: string;
    promptModel?: string;
    promptId?: string;
    imageModel?: string;

    // Generated fields from generatedFields
    chordproFile?: string;
    contentHash?: string;
    availableIllustrations?: string;
}

export const emptySongMetadata = (): SongMetadata => {
    return {
        title: "",
        artist: "",
        key: "",
        dateAdded: "",
        songbooks: "",
        startMelody: "",
        language: "",
        tempo: "",
        capo: "",
        range: "",
        pdfFilenames: "",
        promptModel: "",
        promptId: "",
        imageModel: "",
        chordproFile: "",
        contentHash: "",
        availableIllustrations: ""
    };
};

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
    tempo?: int;
    capo: int;
    range: SongRange;
    illustrationData: IllustrationData;
    chordproFile: string;
    pdfFilenames: Array<string>;
    content?: string;
    contentHash: string;

    constructor(song: SongMetadata) {
        // Verification that SongMetadata has all required fields
        this.validateSongMetadata(song);

        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
        this.key = SongData.parseKey(song.key);
        this.dateAdded = SongData.parseDateAdded(song.dateAdded);
        this.songbooks = SongData.parseSongbooks(song.songbooks, this.artist, this.title);
        this.startMelody = song.startMelody;
        this.language = song.language as SongLanguage || "other";
        this.tempo = SongData.parseTempo(song.tempo);
        this.capo = SongData.parseCapo(song.capo);
        this.range = SongData.parseRange(song.range);
        this.illustrationData = SongData.parseIllustrationData(song);
        this.pdfFilenames = SongData.parsePdfFilenames(song.pdfFilenames, this.artist, this.title);
        this.chordproFile = song.chordproFile || "";
        this.contentHash = song.contentHash || "";
    }

    /**
     * Validates that SongMetadata interface aligns with the expected fields
     * This serves as a runtime check that our types are in sync
     */
    private validateSongMetadata(song: SongMetadata): void {
        // Only run validation in development
        if (process.env.NODE_ENV !== 'production') {
            // Get all known fields from imported lists
            const knownFields = new Set([...Object.keys(song)]);

            // Compare with expected fields
            const expectedFields = new Set([...preambleKeywords.map(f => chordpro2JSKeywords[f]), ...generatedFields]);

            // Check for missing fields in SongMetadata
            const missingFields = [...expectedFields].filter(field => !knownFields.has(field));

            // Check for extra fields in SongMetadata that aren't in our lists
            const extraFields = [...knownFields].filter(field =>
                !expectedFields.has(field) && field !== 'content' && field !== 'disabled');

            // Log warnings for any discrepancies
            if (missingFields.length > 0) {
                console.warn(`Warning: SongMetadata is missing expected fields: ${missingFields.join(', ')}`);
            }
            if (extraFields.length > 0) {
                console.warn(`Warning: SongMetadata has extra fields not in metadata lists: ${extraFields.join(', ')}`);
            }
        }
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

    static parseTempo(tempo?: string | number): int | undefined {
        return tempo ? (parseInt(tempo as string) || undefined) : undefined;
    }

    static parseCapo(capo?: string | number): int {
        return parseInt(capo as string) || 0;
    }

    static parseRange(range?: string): SongRange {
        return new SongRange(range || "");
    }

    static parseIllustrationData(song: SongMetadata): IllustrationData {
        let availableIllustrations = [];
        try { availableIllustrations = JSON.parse(song.availableIllustrations) }
        catch (error) { console.log(`Error parsing pdf filenames for "${song.artist}: ${song.title}"`, error); }
        return new IllustrationData(song.promptModel, song.promptId, song.imageModel, availableIllustrations);
    }

    static parsePdfFilenames(pdfFilenames?: string, artist?: string, title?: string): Array<string> {
        try {
            return pdfFilenames
                ? JSON.parse(pdfFilenames)
                : [];
        } catch (error) {
            console.log(`Error parsing pdf filenames for "${artist}: ${title}"`, error);
            return [];
        }
    }

    static to_ascii(text: string) {
        return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    static id(title: string, artist: string) {
        return `${SongData.to_ascii(artist)}-${SongData.to_ascii(title)}`
            .replace(/ /g, "_")
            .replace(/[^A-Za-z0-9-_]+/g, "")
            .replace(/_+/g, "_");
    }

    get ascii_title() {
        return SongData.to_ascii(this.title);
    }

    get ascii_artist() {
        return SongData.to_ascii(this.artist);
    }

    get id() {
        return SongData.id(this.title, this.artist);
    }

    get pdfURLs() {
        return this.pdfFilenames.map((f: string) => fileURL("songs/pdfs/" + f))
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

    static withoutMetadata(content: string) {
        preambleKeywords.forEach((keyword: string) => {
            content = content?.replace(new RegExp(`{${keyword}:\\s*(.+?)}`, "g"), "");
        });
        return content?.trim();
    }

    addContent(content: string) {
        this.content = SongData.withoutMetadata(content);
    }


    extractMetadata(): Record<string, string> {
        const metadata: Record<string, string> = this.illustrationData.reconstructPreamble();
        preambleKeywords.forEach((k: string) => {
            const JSKey = chordpro2JSKeywords[k];
            if (JSKey in this) {
                const value = this[JSKey as keyof SongData] ?? "";
                if (["string", "number"].includes(typeof value)) {
                    metadata[JSKey] = `${value ?? ""}`;

                } else if (JSKey === "dateAdded") {
                    const date = this.dateAdded;
                    metadata[JSKey] = date ? date.month.toString().padStart(2, "0") + "-" + date.year : "";
                } else if (["songbooks", "pdfFilenames"].includes(JSKey)) {
                    metadata[JSKey] = JSON.stringify(value) ?? "";
                } else if (["key", "range"].includes(JSKey)) {
                    metadata[JSKey] = `${value ?? ""}`;
                }
            }
        });
        if (process.env.NODE_ENV !== 'production') {
            const missing = preambleKeywords.map(k => chordpro2JSKeywords[k]).filter(k => !Object.keys(metadata).includes(k));
            if (missing.length > 0) {
                console.warn(`Missing fields for Extracted Metadata: ${missing.join(', ')}`);
            }
        }
        return metadata;
    }

    toChordpro(): string {
        const metadata = this.extractMetadata();
        const directives = Object.entries(metadata).map(([key, value]) => `{${JS2chordproKeywords[key]}: ${value}}`);
        const preamble = directives.join("\n");

        if (process.env.NODE_ENV !== 'production') {
            const missing = preambleKeywords.filter((keyword: string) => {
                const regex = new RegExp(`^\\{${keyword}:\\s*.+?\\}$`, "m");
                return !regex.test(directives.join("\n"));
            });

            if (missing.length > 0) {
                console.warn(`Missing fields for chordpro preamble: ${missing.join(', ')}`);
            }
        }
        return preamble + "\n\n" + (this.content ?? "");
    }

    private imageURLFactory(folder: string, promptModel?: string, promptId?: string, imageModel?: string): string {
        const stem = promptModel || promptId || imageModel
            ? this.illustrationData.toFilenameStem(promptModel, promptId, imageModel)
            : this.illustrationData.preferredFilenameStem();
        return fileURL(`songs/${folder}/${this.id}/${stem}.webp`);
    }

    thumbnailURL(promptModel?: string, promptId?: string, imageModel?: string): string {
        return this.imageURLFactory("illustrations_thumbnails", promptModel, promptId, imageModel);
    }

    illustrationURL(promptModel?: string, promptId?: string, imageModel?: string): string {
        return this.imageURLFactory("illustrations", promptModel, promptId, imageModel);
    }

    static promptURL(id: string) {
        return fileURL(`songs/image_prompts/${id}.yaml`);
    }

    promptURL() {
        return fileURL(`songs/image_prompts/${this.id}.yaml`);
    }
}

export { SongData }
export type { SongMetadata }