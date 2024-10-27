
import ChordSheetJS, { ChordLyricsPair, ChordSheetSerializer, Tag } from 'chordsheetjs';
import { SongData } from '../../types';
import { Song as ChordSheetJSSong } from 'chordsheetjs';

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

function replaceRepeatedDirective(song: string, directive: string, repeat: boolean, shortHand: string = "R"): string {
    const directiveMap: { [key: string]: string[] } = {};  // Stores directive content by key
    let currentDirective: string[] | null = null;         // To store current directive lines
    let currentKey: string | null = null;                 // The key for the current directive

    // Precompiled regexes for matching start, end, and directive calls
    const startDirectiveRegex = new RegExp(`\\{start_of_${directive}(?::\\s*(\\w+))?\\}`);  // Matches {start_of_directive} or {start_of_directive: key}
    const endDirectiveRegex = new RegExp(`\\{end_of_${directive}\\}`);  // Matches {end_of_directive}
    const directiveCallRegex = new RegExp(`\\{${directive}(?::\\s*(\\w+))?\\}`);  // Matches {directive} or {directive: key}

    // make the deafault key hopefully weird enough that no chorpro file will include it
    const defaultKey = "a4c0d35c95a63a805915367dcfe6b751"

    // Process each line of the song
    const processedContent: string[] = song.split('\n').map(line => {
        // Check for the start of the directive (e.g., {start_of_chorus})
        const startMatch = line.match(startDirectiveRegex);
        if (startMatch) {
            currentKey = startMatch[1] || shortHand || defaultKey;  // Use key or default if no key is provided
            currentDirective = [];  // Initialize the directive content
        }

        // Check for the end of the directive (e.g., {end_of_chorus})
        const endMatch = line.match(endDirectiveRegex);
        if (endMatch && currentDirective) {
            // Store the directive content and reset the current state
            if (currentKey !== defaultKey) { currentDirective[1] = currentKey + ": " + currentDirective[1] }
            console.log(currentDirective)
            directiveMap[currentKey] = [`{start_of_${directive}}`, ...currentDirective, `{end_of_${directive}}`];
            const ret = currentDirective.join('\n');
            currentDirective = null;
            currentKey = null;
            return ret;
        }

        // Check for directive calls (e.g., {chorus})
        const directiveCallMatch = line.match(directiveCallRegex);
        if (directiveCallMatch) {
            const directiveKey = directiveCallMatch[1] || shortHand || defaultKey;  // Use the key or default
            // If repeating is allowed and the directive exists, insert it
            if (repeat && directiveMap[directiveKey]) {
                return directiveMap[directiveKey].join('\n');
            } else {
                // If not repeating, just show shorthand notation for the directive
                console.log(directiveKey)
                return `{start_of_${directive}}\n${directiveKey === defaultKey ? '' : directiveKey}:\n{end_of_${directive}}`;
            }
        }

        // Add the line to the current directive content if inside a directive
        if (currentDirective !== null) {
            currentDirective.push(line);
            return;
        }

        // Regular lines are returned as is
        return line;
    });

    // Join the processed content back into a string
    return processedContent.join('\n').trim();
}

function addRepeatClasses(htmlString, className = "verse") {
    // adds the 'repeated-chords' where appropriate class
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const verses = doc.querySelectorAll(`.${className}`);
    let seen = { "default": false };
    verses.forEach((verse) => {
        console.log(verse);
        const labelElement = verse.querySelector('.label');
        const label = labelElement ? labelElement.textContent.trim() : "default";

        if (seen[label] ?? false) {
            verse.classList.add('repeated-chords');
        } else {
            seen[label] = true;
        }
    });
    console.log(seen)
    return doc.body.innerHTML; // Convert the document back to an HTML string
}

function renderSong(songData: SongData, key: string, repeatChorus: boolean): string {
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    // Convert chords to English and repeat choruses/bridges if necessary
    let song = replaceRepeatedDirective(convertChordsInChordPro(songData.content), "chorus", repeatChorus);
    song = replaceRepeatedDirective(song, "bridge", repeatChorus, "B");
    song = replaceRepeatedDirective(song, "verse", repeatChorus, null);

    // Parse the song using ChordSheetJS
    let parsedSong = parser.parse(song)
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
    return addRepeatClasses(addRepeatClasses(addRepeatClasses(formatter.format(transposedSong), "verse"), "chorus"), "bridge");
}

export { renderSong, guessKey };