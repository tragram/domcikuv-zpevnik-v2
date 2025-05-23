import { EXPANDED_SECTION_DIRECTIVE, SHORTHAND_SECTION_DIRECTIVE } from "./preparseChordpro";

// TypeScript interfaces for better type safety and code documentation
interface ChordElement {
    element: Element;
    chord: string;
}

interface ChordMatch {
    matches: boolean[];
    distance: number;
}

interface PatternCollection {
    [sectionType: string]: {
        [label: string]: string[][];
    };
}

const MAX_CHORD_MATCH_DISTANCE = 3;

/**
 * Default section types to process for repetitions
 */
const DEFAULT_SECTION_TYPES = ["verse", "chorus", "bridge"];

/**
 * Detects repeated chord patterns and adds appropriate CSS classes
 * Optimized to minimize DOM operations
 */
function detectRepeatedChordPatterns(doc: Document, classNames = DEFAULT_SECTION_TYPES, useLabels = false): Document {
    const DEFAULT_KEYS = {
        "verse-section": "V:",
        "bridge-section": "B:",
        "chorus-section": "R:"
    };

    const getDefaultKey = (key: string): string => DEFAULT_KEYS[key] || "a4c0d35c95a63a805915367dcfe6b751";
    const seen: PatternCollection = {};

    // Initialize tracking object for each className
    classNames.forEach(className => {
        seen[className] = {};
    });

    const selector = classNames.map(className => `.${className}`).join(',');
    // Create a document fragment to batch DOM operations
    const sections = Array.from(doc.querySelectorAll(selector));

    // Process all sections in a single pass
    sections.forEach((element) => {
        const elementClass = classNames.find(className => element.classList.contains(className));
        if (!elementClass) return;

        // Cache label info
        const labelElement = element.querySelector('.section-title');
        const defaultKey = getDefaultKey(elementClass);
        const label = labelElement && useLabels ? labelElement.textContent?.trim() || defaultKey : defaultKey;
        // Get all chord elements
        const chordElements = Array.from(element.querySelectorAll('.chord'));

        // keep track of elements as well as chords to be able to highlight changes later
        const chordsWElements: ChordElement[] = [];

        // Process chord data with minimal DOM access
        for (let i = 0; i < chordElements.length; i++) {
            const chord = chordElements[i].textContent?.trim();
            if (chord) {
                chordsWElements.push({
                    element: chordElements[i],
                    chord: chord
                });
            }
        }

        const onlyChords = chordsWElements.map(c => c.chord);

        if (!seen[elementClass][label]) {
            seen[elementClass][label] = [];
        }
        const matchResult = findBestChordPatternMatch(onlyChords, seen[elementClass][label]);
        if (seen[elementClass][label].length === 0 || matchResult.distance > MAX_CHORD_MATCH_DISTANCE) {
            seen[elementClass][label].push(onlyChords);
        } else {
            if (matchResult.distance > 0) {
                seen[elementClass][label].push(onlyChords);
            }

            // Minimize DOM operations by batching class additions
            element.classList.add('repeated-chords');

            // Create a list of elements that need the force-shown class
            const elementsToHighlight = [];

            // Find chords that differ from the pattern
            matchResult.matches.forEach((match, index) => {
                if (index >= chordsWElements.length) return;
                if (!match) {
                    elementsToHighlight.push(chordsWElements[index].element);
                }
            });

            // Add any extra chords
            if (matchResult.matches.length < chordsWElements.length) {
                for (let i = matchResult.matches.length; i < chordsWElements.length; i++) {
                    elementsToHighlight.push(chordsWElements[i].element);
                }
            }

            // Add the class to all elements at once
            elementsToHighlight.forEach(el => el.classList.add("force-shown"));
        }
        if (!seen[elementClass][defaultKey]) {
            seen[elementClass][defaultKey] = [...seen[elementClass][label]];
        }
    });

    return doc;
}

/**
 * Finds the best matching chord pattern from previously seen patterns
 * @param currentChords - Array of current chord names
 * @param knownPatterns - Array of previously seen chord patterns
 * @returns The best matching pattern with distance measure
 */
function findBestChordPatternMatch(currentChords: string[], knownPatterns: string[][]): ChordMatch {
    if (knownPatterns.length === 0) {
        return { matches: [], distance: Infinity };
    }

    // Use reduce instead of map+reduce for better performance
    let bestMatch: ChordMatch = { matches: [], distance: Infinity };
    for (let i = 0; i < knownPatterns.length; i++) {
        const match = compareChordLists(knownPatterns[i], currentChords);
        if (match.distance < bestMatch.distance) {
            bestMatch = match;
        }
    }

    return bestMatch;
}

/**
 * Compares two chord lists and calculates their difference
 * Optimized version that avoids unnecessary array creation
 * @param chords1 - First chord list to compare
 * @param chords2 - Second chord list to compare
 * @returns Match information with distance measure
 */
function compareChordLists(chords1: string[], chords2: string[]): ChordMatch {
    const maxLength = Math.max(chords1.length, chords2.length);
    const matches: boolean[] = new Array(maxLength);
    let distance = 0;

    for (let i = 0; i < maxLength; i++) {
        const match = i < chords1.length && i < chords2.length && chords1[i] === chords2[i];
        matches[i] = match;
        if (!match) distance++;
    }

    return { matches, distance };
}

/**
 * Processes HTML content to handle expanded/shorthand section directives
 * 
 * @param htmlString - The HTML string to process
 * @returns Processed HTML with appropriate classes added and comments removed
 */
function processExpandedSections(
    doc: Document,
): Document {
    // Find comment elements containing our directives
    const commentElements = Array.from(doc.querySelectorAll('.comment-line'));
    // Process each comment element
    commentElements.forEach(element => {
        if (!element.textContent) return;

        const commentText = element.textContent.trim();

        // Check if it's one of our directive comments
        const isExpandedDirective = `{comment: ${commentText}}` === EXPANDED_SECTION_DIRECTIVE;
        const isShorthandDirective = `{comment: ${commentText}}` === SHORTHAND_SECTION_DIRECTIVE;

        if (isExpandedDirective || isShorthandDirective) {
            // Find the parent section element
            let section = element.parentElement;
            while (section && !section.classList.contains('section')) {
                section = section.parentElement;
            }

            if (section) {
                // Add appropriate CSS class
                if (isExpandedDirective) {
                    section.classList.add('expanded-section');
                } else {
                    section.classList.add('shorthand-section');
                }
            }

            // Remove the directive comment element
            element.remove();
        }
    });
    return doc;
}

function processSectionTitles(
    doc: Document
): Document {
    // Find comment elements containing our directives
    const commentElements = Array.from(doc.querySelectorAll('.comment-line'));
    // Process each comment element
    commentElements.forEach(element => {
        if (!element.textContent) return;
        const commentText = element.textContent.trim();
        const sectionTitlePattern = new RegExp("%\\s*section_title:\\s*(.*?)\\s*%");
        const match = commentText.match(sectionTitlePattern);

        if (match) {
            // Find the next lyrics-line element after the comment
            let lyricsLineElement = element.nextElementSibling;
            while (lyricsLineElement) {
                if (lyricsLineElement instanceof HTMLDivElement &&
                    lyricsLineElement.classList.contains('lyrics-line')) {
                    break;
                }
                lyricsLineElement = lyricsLineElement.nextElementSibling;
            }

            // Create the section title div
            const sectionTitleDiv = doc.createElement('div');
            sectionTitleDiv.className = 'section-title';
            sectionTitleDiv.textContent = match[1] + ": ";

            // Create the word div that will contain the section title
            const wordDiv = doc.createElement('div');
            wordDiv.className = 'word';
            wordDiv.appendChild(sectionTitleDiv);

            if (lyricsLineElement && lyricsLineElement instanceof HTMLDivElement) {
                // Insert the word div as the first child of the lyrics-line div
                lyricsLineElement.insertBefore(wordDiv, lyricsLineElement.firstChild);
            } else {
                // If no lyrics-line div exists, create one
                const newLyricsDiv = doc.createElement('div');
                newLyricsDiv.className = 'lyrics-line';

                // Add the word div containing the section title as its first child
                newLyricsDiv.appendChild(wordDiv);

                // Insert the new lyrics-line div after the comment
                const parent = element.parentNode;
                if (parent) {
                    parent.insertBefore(newLyricsDiv, element.nextSibling);
                }
            }
            element.remove()
        }
    });

    return doc;
}

/**
 * Adds repeat classes to chord sections and processes repetitions etc.
 * @param htmlString - HTML string to process
 * @param classNames - Section class names to process
 * @param useLabels - Whether to use section labels for matching
 * @returns Processed HTML string
 */
export function postProcessChordPro(
    htmlString: string,
    classNames = DEFAULT_SECTION_TYPES,
    useLabels = true
): string {
    // Parse HTML only once
    const parser = new DOMParser();
    let doc = parser.parseFromString(htmlString, 'text/html');

    doc = processExpandedSections(doc);
    doc = processSectionTitles(doc);
    // Process the document
    const processedDoc = detectRepeatedChordPatterns(doc, classNames, useLabels);

    // Extract HTML once
    return processedDoc.body.innerHTML;
}