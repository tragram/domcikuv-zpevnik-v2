
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
    min: int;
    max: int;
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

            this.min = parseInt(song_range[0])
            this.max = parseInt(song_range[1])
            this.semitones = 12 * octaves + withinOctave;
            // console.log(lowestTone, highestTone, octaves, withinOctave, 12 * octaves + withinOctave)
        }
    }
}

type SongKey = "C" | "C#" | "D" | "Es" | "E" | "F" | "F#" | "G" | "As" | "A" | "B" | "H"

type SongLanguage = "czech" | "english" | "german" | "slovak" | "polish" | "spanish" | "romanian" | "finnish" | "estonian" | "french" | "italian" | "portuguese" | "other"

class SongData {
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
    chordproFile: string;
    pdfFilenames: Array<string>;

    constructor(song: Object) {
        // function guessKey(song: Object): SongKey {
        //     //TODO: this will fail with keys other than simple C-major chords 
        //     // remove chordpro directives
        //     let lyricsOnly = song.content.replace(/\{.*?\}/g, "")
        //     // regex to match the first chord
        //     const chordRegex = /\[([^\]]+)\]/;
        //     const match = lyricsOnly.match(chordRegex);
        //     // console.log(match)
        //     // if (!match) {
        //     //     console.log("Song", song.artist, "-", song.title, "doesn't have key specified and no chords were found!")
        //     // }
        //     return match ? match[1] : "C";
        // }
        this.title = song.title || "Unknown title";
        this.artist = song.artist || "Unknown artist";
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
        if (song.pdfFilenames) {
            this.pdfFilenames = JSON.parse(song.pdf_filenames.replace(/'/g, '"')).map(f => import.meta.env.BASE_URL + "songs/pdfs/" + f);
        } else {
            this.pdfFilenames = [];
        }
        this.chordproFile = song.chordpro_file;
    }

    lyricsLength() {
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


async function fetchSongs(): Promise<SongDB> {
    const response = await fetch(import.meta.env.BASE_URL + '/songDB.json');
    console.log(response)
    if (!response.ok) {
        throw new Error('Failed to fetch songs');
    }
    try {
        const data = await response.json();
        const songs = data.map(d => new SongData(d));
        let languages: LanguageCount = {};
        songs.forEach(song => {
            languages[song.language] = (languages[song.language] || 0) + 1;
        });
        // TODO: languages with less than e.g. 5 songs should be merged into "other"
        const songRanges = songs.map(s => s.range.semitones);
        return {
            maxRange: Math.max(...songRanges),
            languages: languages,
            songs: songs,
        }
    } catch (error) {
        console.error('Error fetching songs:', error);
        throw error;
    }
}

export default fetchSongs;