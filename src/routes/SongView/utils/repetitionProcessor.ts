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
 * Musical repetition symbols
 */
const REPETITION_SYMBOLS = ['𝄆', '𝄇'];

/**
 * Default section types to process for repetitions
 */
const DEFAULT_SECTION_TYPES = ["verse", "chorus", "bridge"];

/**
 * Detects repeated chord patterns and adds appropriate CSS classes
 * Optimized to minimize DOM operations
 */
function detectRepeatedChordPatterns(doc: Document, classNames = DEFAULT_SECTION_TYPES, useLabels = false): Document {
    const DEFAULT_KEY = "a4c0d35c95a63a805915367dcfe6b751";
    const seen: PatternCollection = {}; 
    
    // Initialize tracking object for each className
    classNames.forEach(className => {
        seen[className] = { [DEFAULT_KEY]: [] };
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
        const label = labelElement && useLabels ? labelElement.textContent?.trim() || DEFAULT_KEY : DEFAULT_KEY;

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
 * Collapses consecutive identical sections with repetition indicators
 * Optimized for fewer DOM operations
 * @param doc - Document to process
 * @param classNames - Section class names to look for
 * @returns Processed document
 */
function collapseConsecutiveRepeatedSections(doc: Document, classNames = DEFAULT_SECTION_TYPES): Document {
    // Cache section elements to avoid repeated DOM queries
    const allSections = Array.from(doc.querySelectorAll('.section'));
    
    // Track sections to remove in one batch at the end
    const sectionsToRemove: Element[] = [];
    const labelsToAdd: { section: Element, count: number }[] = [];
    
    let i = 0;
    while (i < allSections.length) {
        const current = allSections[i];
        const currentClass = classNames.find(className => current.classList.contains(className));

        if (!currentClass || !current.classList.contains('repeated-chords')) {
            i++;
            continue;
        }

        // Find how many consecutive identical sections we have
        let repeatCount = 1;
        let j = i + 1;
        
        // Use cached elements to avoid DOM traversal
        while (j < allSections.length) {
            const next = allSections[j];

            // Check if the next section is immediately adjacent (using cached array order)
            if (j > i + repeatCount) {
                break;
            }

            // Check if it's the same type of section and has the same content
            // Using isEqualNode is more accurate than comparing innerHTML
            if (!next.classList.contains(currentClass) ||
                !next.classList.contains('repeated-chords') ||
                !next.isEqualNode(current)) {
                break;
            }

            repeatCount++;
            j++;
        }

        if (repeatCount > 1) {
            // Track sections to modify later (reduces DOM operations)
            labelsToAdd.push({ section: current, count: repeatCount });
            
            // Queue repeated sections for removal
            for (let k = i + 1; k < i + repeatCount; k++) {
                sectionsToRemove.push(allSections[k]);
            }

            // Skip the sections we've processed
            i += repeatCount;
        } else {
            i++;
        }
    }
    
    // Batch process all labels
    labelsToAdd.forEach(({ section, count }) => {
        const repetitionLabel = doc.createElement('span');
        repetitionLabel.className = 'repetition-count';
        repetitionLabel.textContent = `(${count}×)`;

        // Insert before the first section
        const firstLine = section.querySelector(".lyrics-line");
        if (firstLine) {
            firstLine.insertBefore(repetitionLabel, firstLine.firstChild);
        }
    });
    
    // Batch remove all sections at once
    sectionsToRemove.forEach(section => section.remove());

    return doc;
}

/**
 * Efficiently highlights repetition marks in the music notation
 * @param doc - Document to process
 * @returns Processed document
 */
export function highlightRepetition(doc: Document): Document {
    // Find all lyrics spans in one batch query
    const lyricsSpans = doc.querySelectorAll("span.lyrics");
    const spansToWrap: Element[] = [];
    
    // First identify which spans need wrapping (avoids unnecessary DOM operations)
    lyricsSpans.forEach(span => {
        const text = span.textContent || '';
        if (REPETITION_SYMBOLS.some(symbol => text.includes(symbol))) {
            spansToWrap.push(span);
        }
    });
    
    // Then do the wrapping in a single batch
    spansToWrap.forEach(span => {
        const repetitionDiv = doc.createElement("div");
        repetitionDiv.className = "repetition";
        span.replaceWith(repetitionDiv);
        repetitionDiv.appendChild(span);
    });
    
    return doc;
}

/**
 * Adds repeat classes to chord sections and processes repetitions
 * @param htmlString - HTML string to process
 * @param classNames - Section class names to process
 * @param useLabels - Whether to use section labels for matching
 * @returns Processed HTML string
 */
export function addRepeatClasses(
    htmlString: string, 
    classNames = DEFAULT_SECTION_TYPES, 
    useLabels = false
): string {
    // Parse HTML only once
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Process the document
    const processedDoc = collapseConsecutiveRepeatedSections(
        detectRepeatedChordPatterns(doc, classNames, useLabels),
        classNames
    );

    // Extract HTML once
    return processedDoc.body.innerHTML;
}