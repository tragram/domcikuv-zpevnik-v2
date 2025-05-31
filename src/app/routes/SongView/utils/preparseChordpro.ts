/**
 * ChordPro Parser and Transposer
 * 
 * This module provides functionality for processing ChordPro files:
 * - Handles custom variant directives
 * - Replaces repeated section directives (like chorus)
 * - Converts Czech music notation to English
 * - Transposes chords between musical keys
 */

import type { Key } from '@/../types/musicTypes';
import {
    chordParserFactory,
    chordRendererFactory,
} from 'chord-symbol/lib/chord-symbol.js';
import { hasExactly } from 'chord-symbol/src/helpers/hasElement';

// these are used to pass information about collapsed/shorthand sections to post-processing
// this is an ugly solution but the alternative appears to be writing my own parser
export const EXPANDED_SECTION_DIRECTIVE = "{comment: %expanded_section%}";
export const SHORTHAND_SECTION_DIRECTIVE = "{comment: %shorthand_section%}";
export const SECTION_TITLE_COMMENT = (repeatKey: string | null, consecutiveModifier: string | null) => repeatKey || consecutiveModifier ? `{comment: %section_title: ${consecutiveModifier}${repeatKey}%}` : null;

// ==================== TYPES ====================

/**
 * Valid variation types for part variants
 */
const validVariationValues = [
    "replace_last_line",
    "replace_last_lines",
    "append_content",
    "replace_first_line",
    "prepend_content"
] as const;

type validVariation = (typeof validVariationValues)[number];

// ==================== PART VARIATIONS ====================

/**
 * Applies variations to a section of chord content
 * 
 * @param originalLines - The original content lines
 * @param variantType - The type of variation to apply
 * @param variantContent - The content to use in the variation
 * @param repeat - Whether to include the full content or a placeholder
 * @param sectionTitle - Key identifier for the section
 * @returns Modified array of content lines
 */
function partVariation(
    originalLines: string[],
    variantType: validVariation,
    variantContent: string[],
    repeat: boolean,
    sectionTitle: string
): string[] {
    // Validate inputs
    if (!originalLines) {
        console.log("Error: No original lines found!");
        return [""];
    }

    // Handle multi-line variant content
    if (variantContent.length > 1) {
        variantContent = [variantContent.join('\n').trim()];
    }

    // Skip if content is too short
    if (originalLines.length < 3) {
        console.log(
            "Error: Ignoring part variant",
            variantType,
            "on",
            originalLines,
            "- originalLines content too short!"
        );
        return originalLines;
    }

    // Apply the appropriate variation type
    switch (variantType) {
        case "replace_last_line":
            if (repeat) {
                return [
                    ...originalLines.slice(0, -2),
                    ...variantContent,
                    ...originalLines.slice(-1)
                ];
            } else {
                return [
                    originalLines[0],
                    sectionTitle, " ..." + variantContent,
                    ...originalLines.slice(-1)
                ];
            }

        case "replace_last_lines":
            throw new Error("Error: Replace last lines not yet supported!");

        case "append_content":
            if (repeat) {
                // Assuming first and last line are {start_of_xyz} and {end_of_xyz}
                return [
                    ...originalLines.slice(0, -1),
                    ...variantContent,
                    ...originalLines.slice(-1)
                ];
            } else {
                return [
                    originalLines[0],
                    sectionTitle, " + " + variantContent,
                    ...originalLines.slice(-1)
                ];
            }

        case "replace_first_line":
            if (repeat) {
                // Assuming first and last line are {start_of_xyz} and {end_of_xyz}
                return [
                    ...originalLines.slice(0, 1),
                    sectionTitle, " " + variantContent[0],
                    ...originalLines.slice(2, -1)
                ];
            } else {
                return [
                    originalLines[0],
                    sectionTitle, " " + variantContent[0] + "...",
                    ...originalLines.slice(-1)
                ];
            }

        case "prepend_content": {
            const replaceRegex = new RegExp("^" + sectionTitle, "g");
            if (repeat) {
                // Assuming first and last line are {start_of_xyz} and {end_of_xyz}
                const replacedLines = [
                    ...originalLines.slice(0, 1),
                    sectionTitle, " " + variantContent[0],
                    ...originalLines.slice(1, -1).map(l => l.replace(replaceRegex, ""))
                ];
                return replacedLines;
            } else {
                const replacedLines = [
                    originalLines[0],
                    sectionTitle, " " + variantContent[0] + "...",
                    originalLines[1].replace(replaceRegex, ""),
                    ...originalLines.slice(-1)
                ];
                return replacedLines;
            }
        }

        default:
            return originalLines;
    }
}

/**
 * Applies variations to a section of chord content.
 * Wrapper to partVariation that adds a meta information tag about whether it's expanded or not.
 * 
 * @param originalLines - The original content lines
 * @param variantType - The type of variation to apply
 * @param variantContent - The content to use in the variation
 * @param repeat - Whether to include the full content or a placeholder
 * @param sectionTitle - Key identifier for the section
 * @returns Modified array of content lines
 */
function partVariationWithMetaInfo(
    originalLines: string[],
    variantType: validVariation,
    variantContent: string[],
    repeat: boolean,
    sectionTitle: string
): string[] {
    const variation = partVariation(originalLines, variantType, variantContent, repeat, sectionTitle);
    variation.splice(1, 0, repeat ? EXPANDED_SECTION_DIRECTIVE : SHORTHAND_SECTION_DIRECTIVE)
    return variation;
}

// ==================== DIRECTIVE PROCESSING ====================

/**
 * Detects sequences of consecutive identical directive recalls and returns information
 * about them for compression
 * 
 * @param content - Content lines to analyze
 * @param position - Current position in content
 * @param callRegex - Regular expression to match directive calls
 * @returns Object with information about consecutive recalls, or null if none found
 */
function detectConsecutiveRecalls(
    content: string[],
    position: number,
    callRegex: RegExp
): { count: number, key: string, lastIndex: number } {
    let consecutiveRecalls = 0;
    let currentKey = '';
    let lastIndex = position;

    // Look ahead for consecutive recalls of the same directive
    while (lastIndex < content.length) {
        if (!content[lastIndex].trim()) {
            // ignore empty lines
            lastIndex++;
            continue;
        }
        const callMatch = content[lastIndex].match(callRegex);
        if (!callMatch) break;

        const matchKey = callMatch[1] || '';

        // First recall or keys match
        if (consecutiveRecalls === 0 || matchKey === currentKey) {
            consecutiveRecalls++;
            currentKey = matchKey;
            lastIndex++;
        } else {
            break; // Different key, end the streak
        }
    }

    return {
        count: consecutiveRecalls,
        key: currentKey,
        lastIndex: lastIndex - 1
    };
}


/**
 * Replaces shorthand directives with both their full content and shorthand version.
 * This means that postprocessing needs to be applied to the HTML after parsing by the chordpro parser to hide either one.
 * 
 * Compresses consecutive directive recalls.
 * 
 * Also replaces custom extensions to the ChordPro format with stuff that can be parsed by a regular ChordPro parser.
 * 
 * 
 * @param song - The ChordPro song content
 * @param directives - Array of directive names to process
 * @param shortHands - Array of shorthand identifiers corresponding to directives
 * @returns Processed song with expanded directives and compressed recalls
 */
export function preparseDirectives(
    song: string,
    directives: string[] = ["chorus"],
    shortHands: string[] = ["R"],
): string {
    // Validate inputs
    if (directives.length !== shortHands.length) {
        throw new Error("Directives and shortHands must be the same length.");
    }

    // Maps to store directive content by key
    const directiveMaps: { [directive: string]: { [key: string]: string[] } } = {};
    const directivesAdded: { [directive: string]: string[] } = {};

    // Create regex patterns for each directive
    const directiveRegexes = directives.map((directive, i) => ({
        directive,
        shortHand: shortHands[i],
        startRegex: new RegExp(`^\\{start_of_${directive}(?::\\s*([\\w\\-_+. \\p{L}]+))?\\}`, 'u'),
        endRegex: new RegExp(`^\\{end_of_${directive}\\}`, 'u'),
        callRegex: new RegExp(`^\\{${directive}(?::\\s*([\\w\\-_+. \\p{L}]+))?\\}`, 'u')
    }));

    // Default key for when none is specified
    // make the default key hopefully weird enough that no chordpro file will include it
    const defaultKey = "a4c0d35c95a63a805915367dcfe6b751";

    // Track current state
    let currentDirective: string | null = null;
    let currentContent: string[] | null = null;
    let currentKey: string | null = null;
    let currentVariationType: validVariation | null = null;
    let currentVariationContent: string[] | null = null;
    let variantActive = false;

    // Regex for variants
    const variantStartRegex = new RegExp("^\\{start_of_variant: ([\\w\\-_+]+)\\}");
    const variantEndRegex = new RegExp("^\\{end_of_variant\\}");

    // Process each line of the song
    const processedLines: string[] = [];
    const songLines = song.split('\n');
    let i = 0;
    while (i < songLines.length) {
        const line = songLines[i];

        // Check for variant start
        const variantStartMatch = line.match(variantStartRegex);
        if (variantStartMatch) {
            if (!validVariationValues.includes(variantStartMatch[1] as validVariation)) {
                console.log("Invalid variant type:", variantStartMatch[1], "--> Skipping...");
                i++;
                continue;
            }
            currentVariationType = variantStartMatch[1] as validVariation;
            currentVariationContent = [];
            variantActive = true;
            i++;
            continue;
        }

        // Check for variant end
        const variantEndMatch = line.match(variantEndRegex);
        if (variantEndMatch) {
            variantActive = false;
            i++;
            continue;
        }

        // Collect variant content
        if (variantActive) {
            if (!currentVariationContent) {
                currentVariationContent = [];
                console.log("Warning: variantActive but currentVariationContent is null!")
            }
            currentVariationContent.push(line);
            i++;
            continue;
        }

        // Process directive start/end
        let directiveMatched = false;
        for (const { directive, shortHand, startRegex, endRegex, callRegex } of directiveRegexes) {
            // Check for directive start
            const startMatch = line.match(startRegex);
            if (startMatch) {
                currentDirective = directive;
                currentKey = startMatch[1] || shortHand || defaultKey;
                currentContent = [line];
                directiveMaps[directive] = directiveMaps[directive] || {};
                directivesAdded[directive] = directivesAdded[directive] || [];
                directiveMatched = true;
                break;
            }
            // Check for directive end
            const endMatch = line.match(endRegex);
            if (endMatch && currentContent && currentDirective === directive) {
                currentContent.push(line);
                if (!currentKey) {
                    console.log("Error: Directive key not found!");
                    currentKey = defaultKey;
                }
                directiveMaps[directive][currentKey] = currentContent;
                directivesAdded[directive].push(currentKey);
                if (currentKey !== defaultKey) {
                    currentContent.splice(1, 0, SECTION_TITLE_COMMENT(currentKey, "") ?? "");
                }
                processedLines.push(currentContent.join('\n'));
                currentDirective = null;
                currentContent = null;
                currentKey = null;
                directiveMatched = true;
                break;
            }

            // Check for (consecutive) directive recalls
            const callMatch = line.match(callRegex);
            let consecutiveModifier = "";
            if (callMatch) {
                const consecutiveInfo = detectConsecutiveRecalls(
                    songLines,
                    i,
                    callRegex
                );
                if (consecutiveInfo.count > 1) {
                    // We found consecutive recalls of the same directive
                    consecutiveModifier = `(${consecutiveInfo.count}x) `;
                    i = consecutiveInfo.lastIndex;
                }

                let directiveKey = callMatch[1] || shortHand || defaultKey;
                let contentToInsert;
                if (directivesAdded[directive]?.includes(directiveKey)) {
                    contentToInsert = directiveMaps[directive][directiveKey];
                }
                else {
                    if (directivesAdded[directive]) {
                        const newDirectiveKey = directivesAdded[directive].slice(-1)[0];
                        console.log(`Warning: Recalled part "${directiveKey}" not found! Recalling the last section of the same type (${directive}) - ${newDirectiveKey}!`);
                        directiveKey = newDirectiveKey;
                        contentToInsert = directiveMaps[directive][directiveKey];
                    } else {
                        console.log(`Warning: Recalled part "${directive}" not found! No section of the same type has been recorded --> ignoring...`);
                        break;
                    }
                }
                const sectionTitle = SECTION_TITLE_COMMENT(directiveKey === defaultKey ? "" : directiveKey, consecutiveModifier);

                if (currentVariationContent) {
                    // insert variation if applicable
                    if (!currentVariationType) {
                        console.log("Error: currentVariationType null unexpectedly - skipping part variation!")
                    } else {
                        // insert the expanded version...
                        contentToInsert = partVariationWithMetaInfo(
                            contentToInsert,
                            currentVariationType,
                            currentVariationContent,
                            true,
                            sectionTitle ?? ""
                        );
                        // ...as well as the short-hand version
                        contentToInsert.push(...partVariationWithMetaInfo(
                            contentToInsert,
                            currentVariationType,
                            currentVariationContent,
                            false,
                            sectionTitle ?? ""
                        ));
                        currentVariationType = null;
                        currentVariationContent = null;
                    }
                } else {
                    // or just recall the contents - both expanded and shorthand
                    try {
                        contentToInsert = [
                            contentToInsert[0],
                            EXPANDED_SECTION_DIRECTIVE,
                            contentToInsert[1],
                            ...contentToInsert.slice(2),

                            `{start_of_${directive}}`,
                            SHORTHAND_SECTION_DIRECTIVE,
                            sectionTitle ?? "",
                            // include the recalled part even in shorthand if it's only a single line
                            contentToInsert.length === 3 ? contentToInsert[1] : "",
                            `{end_of_${directive}}`
                        ];
                    }
                    catch(error){
                        console.log(error)
                    }
                }

                if (contentToInsert) {
                    processedLines.push(contentToInsert.filter(c => c).join('\n'));
                    directiveMatched = true;
                }
            }
        }
        // If no directive matched, add as regular line
        if (!directiveMatched) {
            // If inside a directive, add to current content
            if (currentContent !== null) {
                currentContent.push(line);
            } else if (line) {
                processedLines.push(line);
            }

        }
        i++;
    }
    // Join the processed lines
    return processedLines
        .map(l => l ? l.trim() : null)
        .filter(p => p)
        .join('\n')
        .trim();
}


// ==================== NOTATION CONVERSION ====================

/**
 * Converts Czech chord notation to English
 * Specifically: H -> B and B -> Bb
 * 
 * @param song - The song content in ChordPro format
 * @returns Processed song with converted notation
 */
export function czechToEnglish(song: string): string {
    // Convert key directive
    song = song.replace(/\{key: B([ieasm#b]){0,5}\}/g, "{key: Bb$1}");
    song = song.replace(/\{key: H([ieasm#b]){0,5}\}/g, "{key: B$1}");

    // Convert chords with bass notes
    song = song.replace(/\[([A-Za-z\d#b,\s/]{0,10})\/B\]/g, "[$1/Bb]");
    song = song.replace(/\[([A-Za-z\d#b,\s/]{0,10})\/H\]/g, "[$1/B]");

    // Convert regular chords
    song = song.replace(/\[B([A-Za-z\d#b,\s/]{0,10})\]/g, "[Bb$1]");
    song = song.replace(/\[H([A-Za-z\d#b,\s/]{0,10})\]/g, "[B$1]");

    return song;
}

// ==================== CHORD TRANSPOSITION ====================

/**
 * Transposes all chords in a ChordPro format song
 * 
 * @param song - The song content in ChordPro format
 * @param songKey - The current key of the song
 * @param transposeSteps - Number of semitones to transpose
 * @returns Processed song with transposed chords
 */
export function transposeChordPro(song: string, songKey: Key, transposeSteps: number): string {
    // Skip if can't transpose
    if (!songKey || !transposeSteps) {
        return song;
    }

    // Calculate new key and prepare parser
    const newKey = songKey.transposed(transposeSteps);
    const normalizedKey = songKey.note.toString()
        .replace("B", "Bb")
        .replace("H", "B");

    const parseChord = chordParserFactory({ key: normalizedKey });

    /**
     * Preserves specific chord notations that would otherwise be altered
     */
    const keepSus2Maj7 = (chord) => {
        // Helper to overwrite descriptor
        function overwriteDescriptor(chord, descriptor) {
            const { rootNote, bassNote } = chord.formatted;
            let symbol = rootNote + descriptor;
            if (bassNote) {
                symbol += '/' + bassNote;
            }
            chord.formatted.symbol = symbol;
            return chord;
        }

        // Fix sus2 notation (library renames sus2 to (omit3,add9) by default)
        if (hasExactly(chord.normalized.intervals, ['1', '5', '9'])) {
            chord = overwriteDescriptor(chord, "sus2");
        }
        // Fix maj7 notation (library uses ma7)
        else if (chord.formatted.descriptor == "ma7") {
            chord = overwriteDescriptor(chord, "maj7");
        }
        // Fix sus4 notation (library uses just sus)
        else if (chord.formatted.descriptor == "sus") {
            chord = overwriteDescriptor(chord, "sus4");
        }

        return chord;
    };

    /**
     * Removes unnecessary parentheses from chord modifiers
     */
    const hideParentheses = (chord) => {
        // I don't like parentheses around my chord modifiers...
        // Keep parentheses for multiple modifiers
        if (chord.formatted.symbol.includes(",")) {
            return chord;
        }

        // Remove parentheses for single modifiers
        chord.formatted.symbol = chord.formatted.symbol
            .replace("(", "")
            .replace(")", "");

        return chord;
    };

    // Configure chord renderer
    const renderChord = chordRendererFactory({
        notationSystem: "english",
        transposeValue: transposeSteps,
        accidental: newKey.isFlat() ? "flat" : "sharp",
        customFilters: [keepSus2Maj7, hideParentheses]
    });

    // Process all chord brackets
    const convertChordBracket = (match: string, chord: string) =>
        `[${renderChord(parseChord(chord))}]`;

    return song.replace(/\[([A-Ha-h][A-Za-z\d#b,\s/]{0,10})\]/g, convertChordBracket);
}