
import ChordSheetJS, { ChordLyricsPair } from 'chordsheetjs';


const CHROMATIC_SCALE: { [key: string]: number } = {
    "c": 0,
    "c#": 1,
    "db": 1,
    "des": 1,
    "d": 2,
    "d#": 3,
    "eb": 3,
    "es": 3,
    "e": 4,
    "f": 5,
    "f#": 6,
    "gb": 6,
    "g": 7,
    "g#": 8,
    "ab": 8,
    "as": 8,
    "a": 9,
    "a#": 10,
    // "bb": 10,
    "b": 10,
    "h": 11
};

// Dictionary mapping between English and German chords
const ENGLISH2GERMAN: { [key: string]: string } = {
    "A": "A", "B": "H", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G",
    "A#": "A#", "C#": "C#", "D#": "D#", "F#": "F#", "G#": "G#",
    "Ab": "Ab", "Bb": "B", "Cb": "Cb", "Db": "Db", "Eb": "Eb", "Gb": "Gb",
};

const GERMAN2ENGLISH: { [key: string]: string } = {
    "A": "A", "H": "B", "B": "Bb", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G",
};

function guessKey(songContent: string): string {
    const chordRegex = /\[[A-Ha-h].{0,10}\]/;
    const match = songContent.match(chordRegex);
    if (!match) return "C"; // Default key if no chord is found

    const matchedChord = match[0].slice(1, -1);
    if (matchedChord.length > 2 && matchedChord.slice(1, 3) === "es") {
        return matchedChord.slice(0, 3); // For chords like "Des"
    }
    if (matchedChord.length > 1 && ["#", "b", "s"].includes(matchedChord[1])) {
        return matchedChord.slice(0, 2); // For chords like "C#", "Db"
    }
    return matchedChord[0]; // Return first letter for simple chords
}

function convertChord(chord: string, toEnglish: boolean = true): string | null {
    // chordsheet.js does not support german/czech chord names
    // Function to convert a single chord (e.g., "Ami7") between English and German
    if (!chord || typeof chord !== 'string') return chord;
    // Extract the base note (first letter) and keep the rest of the chord (suffix)
    let baseNote = chord[0].toUpperCase(); // First letter is the base chord
    let suffix = chord.slice(1); // The rest of the chord (e.g., "m", "7")
    if (suffix.length > 0 && suffix.startsWith('b') && !toEnglish) {
        baseNote += suffix[0];
        suffix = suffix.slice(1);
        }

    // Convert the base note
    const convertedBase = toEnglish ? GERMAN2ENGLISH[baseNote] : ENGLISH2GERMAN[baseNote];

    // Return the converted chord with the original suffix
    return convertedBase ? convertedBase + suffix : chord;
}

function convertChordsInChordPro(content: string, toEnglish: boolean = true): string {
    // Convert key directive
    const convertKeyDirective = (match: string, key: string) => `{key: ${convertChord(key, toEnglish)}}`;
    content = content.replace(/\{key:\s*([A-Ha-h][^\s]*)\}/, convertKeyDirective);
  
    // Convert chords inside square brackets
    const convertChordBracket = (match: string, chord: string) => `[${convertChord(chord, toEnglish)}]`;
    content = content.replace(/\[([A-Ha-h][^\]]{0,10})\]/g, convertChordBracket);
  
    return content;
  }

function replaceRepeatedDirective(song, directive, repeat, shortHand = "R") {
    // ChordSheetJS doesn't know the {chorus} directive but I want to use it
    const directiveMap = {}; // To store directive sections by key
    let currentdirective = null; // To store the current directive being captured
    let currentKey = null; // The key for the directive

    // Regex to match the start and end of directive
    const startOfdirectiveRegex = new RegExp(`\{start_of_${directive}(?::\\s*(\\w+))?\}`); // Matches {start_of_directive} or {start_of_directive: key}
    const endOfdirectiveRegex = new RegExp(`\{end_of_${directive}\}`); // Matches {end_of_directive}
    const directiveCallRegex = new RegExp(`\{${directive}(?::\\s*(\\w+))?\}`); // Matches {directive} or {directive: key}
    // Split content into lines
    const lines = song.split('\n');
    let processedContent = [];
    // Process each line
    for (let line of lines) {
        // Check for {start_of_directive} or {start_of_directive: key}
        let startMatch = line.match(startOfdirectiveRegex);
        if (startMatch) {
            currentKey = startMatch[1] || 'default'; // Use key or default if no key is provided
            currentdirective = [];
            continue; // Skip this line from output
        }

        // Check for {end_of_directive}
        let endMatch = line.match(endOfdirectiveRegex);
        if (endMatch) {
            if (currentdirective && currentKey) {
                currentdirective[0] = `${currentKey != "default" ? currentKey : shortHand}: ` + currentdirective[0]
                // Store the directive with the start and end directives
                directiveMap[currentKey] = [`{start_of_${directive}}`].concat(currentdirective).concat([`{end_of_${directive}}`]);
            }
            processedContent.push(...directiveMap[currentKey]);
            currentdirective = null;
            currentKey = null;
            continue; // Skip this line from output
        }

        // Check for {directive} or {directive: key}
        let directiveCallMatch = line.match(directiveCallRegex);
        if (directiveCallMatch) {
            const directiveKey = directiveCallMatch[1] || 'default'; // Recall the directive with the key or the default one
            if (repeat && directiveMap[directiveKey]) {
                processedContent.push(...directiveMap[directiveKey]); // Insert the stored directive content
            } else {
                processedContent.push(`{start_of_${directive}}\n${directiveKey != "default" ? directiveKey : shortHand}:\n{end_of_${directive}}`)
            }
            continue; // Skip the {directive} line
        }

        // If we are inside a directive, add the line to the directive
        if (currentdirective !== null) {
            currentdirective.push(line);
        } else {
            // Otherwise, add the line to the processed content
            processedContent.push(line);
        }
    }
    return processedContent.join('\n');
}

function renderSong(songData: SongData, key: string, repeatChorus: boolean): string {
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    // Convert chords to English and repeat choruses/bridges if necessary
    let song = replaceRepeatedDirective(convertChordsInChordPro(songData.content), "chorus", repeatChorus);
    song = replaceRepeatedDirective(song, "bridge", repeatChorus, "B");
  
    // Parse the song using ChordSheetJS
    const parsedSong = parser.parse(song)
      .setCapo(0)
      .setKey(convertChord(songData.key, true));
  
    // Transpose the song
    const transpositionAmount = CHROMATIC_SCALE[key.toLowerCase()] - CHROMATIC_SCALE[songData.key.toLowerCase()];
    let transposedSong = parsedSong.transpose(transpositionAmount);
  
    // Convert back to Czech/German chord names after transposition
    transposedSong = transposedSong.mapItems((item) => {
      if (item instanceof ChordLyricsPair) {
        return new ChordLyricsPair(convertChord(item.chords, false), item.lyrics, item.annotation);
      }
      return item;
    });
  
    // Format the final song into HTML
    return formatter.format(transposedSong);
  }

export { renderSong, guessKey };