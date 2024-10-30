import {
    chordParserFactory,
    chordRendererFactory,
} from 'chord-symbol/lib/chord-symbol.js'; // bundled version

const validVariationValues = ["replace_last_line", "replace_last_lines", "append_content"] as const;
type validVariation = (typeof validVariationValues)[number]

function partVariation(originalLines: string[], variantType: validVariation, variantContent: string[], repeat: boolean, repeatKey: string): string[] {
    console.log(variantType)
    if (originalLines.length < 3) {
        console.log("Ignoring part variant ", variantType, " on ", originalLines, " - originalLines content too short!")
        return originalLines;
    }
    if (variantType === "replace_last_line") {
        if (repeat) {
            const replacedLines = [...originalLines.slice(0, -2), ...variantContent, ...originalLines.slice(-1)];
            return replacedLines;
        } else {
            const replacedLines = [originalLines[0], repeatKey + " ..." + variantContent, ...originalLines.slice(-1)]
            return replacedLines;
        }
    } else if (variantType === "replace_last_lines") {
        throw new Error("Replace last lines not yet supported!")
    } else if (variantType === "append_content") {
        if (repeat) {
            // assuming first and last line are {start_of_xyz} and {end_of_xyz}
            const replacedLines = [...originalLines.slice(0, -1), ...variantContent, ...originalLines.slice(-1)];
            return replacedLines;
        } else {
            const replacedLines = [originalLines[0], repeatKey + " + " + variantContent, ...originalLines.slice(-1)]
            return replacedLines;
        }
    }
}

export function replaceRepeatedDirectives(song: string, directives: string[] = ["chorus"], shortHands: string[] = ["R"], repeat: boolean = true): string {
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
    let variantActive = false;
    let variantStartRegex = new RegExp("^\\{start_of_variant: (\\w+)\\}")
    let variantEndRegex = new RegExp("^\\{end_of_variant\\}")
    // make the deafault key hopefully weird enough that no chorpro file will include it
    const defaultKey = "a4c0d35c95a63a805915367dcfe6b751"

    // Process each line of the song
    const processedContent: string[] = song.split('\n').map(line => {
        // check for any variant
        const variantStartMatch = line.match(variantStartRegex);
        if (variantStartMatch) {
            console.log(variantStartMatch)
            if (!validVariationValues.includes(variantStartMatch[1])) {
                console.log("Invalid variant type: ", currentVariationType, " --> Skipping...")
                return;
            }
            currentVariationType = variantStartMatch[1] as validVariation;
            currentVariationContent = [];
            variantActive = true;
            return;
        }
        const variantEndMatch = line.match(variantEndRegex);
        if (variantEndMatch) {
            variantActive = false;
            return;
        }
        if (variantActive) {
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
    // remove any nulls and join the processed content back into a string
    return processedContent.map(l => l ? l.trim() : null).filter(p => p).join('\n').trim();
}


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

export function convertChordsInChordPro(content: string, songKey, newKey: string | null = null): string {
    // converts chords and key from German to English convention because all JS chordpro parser are oblivious to the fact that not everyone uses english conventions
    const flatKey = newKey && (newKey.includes("b") || newKey.includes("s"))
    const parseChord = chordParserFactory({ notationSystems: ["german"], key: songKey });
    const CHROMATIC_SCALE: { [key: string]: number } = {
        "c": 0, "c#": 1, "db": 1, "des": 1, "d": 2, "d#": 3, "eb": 3, "es": 3, "e": 4, "f": 5, "f#": 6, "gb": 6, "g": 7, "g#": 8, "ab": 8, "as": 8, "a": 9, "a#": 10, "b": 10, "h": 11
    };
    const canTranspose = songKey && newKey
    const transposeValue = canTranspose ? CHROMATIC_SCALE[newKey.toLowerCase()] - CHROMATIC_SCALE[songKey.toLowerCase()] : 0
    const renderChord = chordRendererFactory({ notationSystem: "english", transposeValue: transposeValue, accidental: flatKey ? "flat" : "sharp" });
    // Convert key directive
    const convertKeyDirective = (match: string, key: string) => `{key: ${renderChord(parseChord(key))}}`;
    content = content.replace(/\{key:\s*([A-Ha-h](#|b|s|is|es)?[^\s]*)\}/, convertKeyDirective);

    // Convert chords inside square brackets
    const convertChordBracket = (match: string, chord: string) => `[${renderChord(parseChord(chord))}]`;
    content = content.replace(/\[([A-Ha-h][^\]]{0,10})\]/g, convertChordBracket);

    return content;
}
