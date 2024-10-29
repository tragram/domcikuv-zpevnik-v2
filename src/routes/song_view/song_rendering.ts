
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

const validVariationValues = ["replace_last_line", "replace_last_lines", "append_content"] as const;
type validVariation = (typeof validVariationValues)[number]

function partVariation(originalLines: string[], variationType: validVariation, variationContent: string[], repeat: boolean, repeatKey: string): string[] {
    if (originalLines.length < 3) {
        console.log("Ignoring part variation ", variationType, " on ", originalLines, " - originalLines content too short!")
        return originalLines;
    }
    if (variationType === "replace_last_line") {
        if (repeat) {
            const replacedLines = [...originalLines.slice(0, -2), ...variationContent, ...originalLines.slice(-1)];
            return replacedLines;
        } else {
            const replacedLines = [originalLines[0], repeatKey + " ..." + variationContent, ...originalLines.slice(-1)]
            return replacedLines;
        }
    } else if (variationType === "replace_last_lines") {
        throw new Error("Replace last lines not yet supported!")
    } else if (variationType === "append_content") {
        if (repeat) {
            // assuming first and last line are {start_of_xyz} and {end_of_xyz}
            const replacedLines = [...originalLines.slice(0, -1), ...variationContent, ...originalLines.slice(-1)];
            return replacedLines;
        } else {
            const replacedLines = [originalLines[0], repeatKey + " + " + variationContent, ...originalLines.slice(-1)]
            return replacedLines;
        }
    }
}

function replaceRepeatedDirectives(song: string, directives: string[] = ["chorus"], shortHands: string[] = ["R"], repeat: boolean = true): string {
    // Takes care of replacing the shorthand directives ({chorus}) that aren't supported by the parsers by whatever's appropriate. Supports custom extensions to the ChordPro format as defined in the README.md file.
    if (directives.length !== shortHands.length) {
        throw new Error("Directives and shortHands must be the same length.");
    }
    const directiveMaps: { [directive: string]: { [key: string]: string[] } } = {};  // Stores content for each directive by key
    const directiveRegexes = directives.map((directive, i) => ({
        directive,
        shortHand: shortHands[i],
        startRegex: new RegExp(`^\\{start_of_${directive}(?::\\s*(\\w+))?\\}`),
        endRegex: new RegExp(`^\\{end_of_${directive}\\}`),
        callRegex: new RegExp(`^\\{${directive}(?::\\s*(\\w+))?\\}`)
    }));

    let currentDirective: string | null = null;         // To store current directive lines
    let currentContent: string[] | null = null;             // Current directive's content
    let currentKey: string | null = null;

    let currentVariationType: validVariation | null = null;
    let currentVariationContent: string[] | null = null;
    let variationActive = false;
    let variationStartRegex = new RegExp("^\\{start_of_variation: (\\w+)\\}")
    let variationEndRegex = new RegExp("^\\{end_of_variation\\}")
    // make the deafault key hopefully weird enough that no chorpro file will include it
    const defaultKey = "a4c0d35c95a63a805915367dcfe6b751"

    // Process each line of the song
    const processedContent: string[] = song.split('\n').map(line => {
        // check for any variation
        const variationStartMatch = line.match(variationStartRegex);
        if (variationStartMatch) {
            if (!validVariationValues.includes(variationStartMatch[1])) {
                console.log("Invalid variation type: ", currentVariationType, " --> Skipping...")
                return;
            }
            currentVariationType = variationStartMatch[1] as validVariation;
            currentVariationContent = [];
            variationActive = true;
            return;
        }
        const variationEndMatch = line.match(variationEndRegex);
        if (variationEndMatch) {
            variationActive = false;
            return;
        }
        if (variationActive) {
            currentVariationContent.push(line);
            return;
        }

        // Check each directive's start, end, and call matches
        for (const { directive, shortHand, startRegex, endRegex, callRegex } of directiveRegexes) {
            // Check for the start of a directive
            const startMatch = line.match(startRegex);
            if (startMatch) {
                currentDirective = directive;
                currentKey = startMatch[1] || shortHand || defaultKey;
                currentContent = [line];
                directiveMaps[directive] = directiveMaps[directive] || {};
                return;  // Skip to the next line after marking the start
            }

            // Check for the end of a directive
            const endMatch = line.match(endRegex);
            if (endMatch && currentContent && currentDirective === directive) {
                currentContent.push(line);
                directiveMaps[directive][currentKey] = currentContent;
                if (currentKey !== defaultKey) {
                    currentContent[1] = currentKey + ": " + currentContent[1];
                }
                const currentBlock = currentContent;
                currentDirective = null;
                currentContent = null;
                currentKey = null;
                return currentBlock.join('\n');
            }

            // Check for a directive call
            const callMatch = line.match(callRegex);
            if (callMatch) {
                const directiveKey = callMatch[1] || shortHand || defaultKey;
                let contentToInsert = directiveMaps[directive][directiveKey];
                const repeatKey = `${directiveKey === defaultKey ? '' : `${directiveKey}:`}`
                if (currentVariationContent) {
                    contentToInsert = partVariation(contentToInsert, currentVariationType, currentVariationContent, repeat, repeatKey);
                    currentVariationType = null;
                    currentVariationContent = null;
                } else if (!repeat) {
                    contentToInsert = [`{start_of_${directive}}`, repeatKey, `{end_of_${directive}}`]
                }

                if (contentToInsert) { return contentToInsert.join('\n'); }
            }
        }

        // If inside a directive, add line to current content
        if (currentContent !== null) {
            currentContent.push(line);
            return;
        }

        // Regular line
        return line;
    });
    console.log(processedContent.filter(p => p))
    // remove any nulls and join the processed content back into a string
    return processedContent.filter(p => p).map(l => l.trim()).join('\n').trim();
}

function addRepeatClasses(htmlString, className = "verse") {
    // adds the 'repeated-chords' where appropriate class
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const verses = doc.querySelectorAll(`.${className}`);
    let seen = { "default": false };
    verses.forEach((verse) => {
        const labelElement = verse.querySelector('.label');
        const label = labelElement ? labelElement.textContent.trim() : "default";
        const chords_str = Array.from(verse.querySelectorAll('.chord')).map(el => el.textContent.trim()).filter(el => el).join('_')
        if (!seen[label]) {
            seen[label] = [];
        }
        if (seen[label].includes(chords_str)) {
            verse.classList.add('repeated-chords');
        } else {
            seen[label].push(chords_str);
        }
    });
    return doc.body.innerHTML; // Convert the document back to an HTML string
}

import { ChordProParser, FormatterSettings, HtmlFormatter } from "chordproject-parser";
function renderSong(songData: SongData, key: string, repeatChorus: boolean): string {
    let preparsedContent = replaceRepeatedDirectives(songData.content, ["chorus", "bridge", "verse"], ["R", "B", ""], repeatChorus);

    // const parser = new ChordProParser();
    // const song = parser.parse(preparsedContent);
    // const settings = new FormatterSettings();
    // settings.showMetadata = false;
    // const formatter = new HtmlFormatter(settings);
    // const songText = formatter.format(song);
    // return songText.join("");

    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    // Convert chords to English and repeat choruses/bridges if necessary
    // Parse the song using ChordSheetJS
    let parsedSong = parser.parse(convertChordsInChordPro(preparsedContent))
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