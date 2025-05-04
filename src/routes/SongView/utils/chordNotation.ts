
/**
 * Musical repetition symbols
 */
const REPETITION_SYMBOLS = ['𝄆', '𝄇'];

/**
 * Efficiently highlights repetition marks in the music notation
 * @param doc - Document to process
 * @returns Processed document
 */
function highlightRepetition(doc: Document): Document {
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
 * Maps for chord name conversion and substitution
 */
const CHORD_NOTATION_MAP = {
    'b': '♭',
    '#': '♯'
};

const CHORD_MODIFIER_REGEX = /(♯|♭|2|4|6|7|9|maj|sus|\+|\([^()]*\))/g;

/**
 * Converts English chord names to Central European notation (H/B system)
 * This is the system used in Czech, German, Polish, Nordic countries, etc.
 */
export function convertChordNotation(chord: string): string {
    if (!chord) return chord;

    const trimmedChord = chord.trim();

    // Handle B flat (Bb) becoming B in Central European notation
    if (trimmedChord.startsWith("Bb")) {
        return "B" + trimmedChord.slice(2);
    }
    // Handle B becoming H in Central European notation
    else if (trimmedChord.startsWith("B")) {
        return "H" + trimmedChord.slice(1);
    }
    // Handle chords ending with Bb
    else if (trimmedChord.endsWith("Bb")) {
        return trimmedChord.slice(0, -2) + "B";
    }
    // Handle chords ending with B
    else if (trimmedChord.endsWith("B")) {
        return trimmedChord.slice(0, -1) + "H";
    }

    return chord;
}

/**
 * Formats a chord with proper notation and superscripts
 * @param chordText - The chord text to format
 * @param centralEuropeanNotation - Whether to use Central European notation (H/B system)
 * @returns Formatted chord HTML
 */
export function formatChord(chordText: string): string {
    if (!chordText) return '';

    // Replace flat and sharp signs
    let formatted = chordText;
    for (const [symbol, replacement] of Object.entries(CHORD_NOTATION_MAP)) {
        formatted = formatted.replace(new RegExp(symbol, 'g'), replacement);
    }

    // Add superscript to modifiers
    return formatted.replace(CHORD_MODIFIER_REGEX, "<sup>$1</sup>");
}

/**
 * Converts chord notation in HTML to Central European notation and adds formatting
 * @param songText - HTML song text to process
 * @returns Processed HTML with converted chord notation
 */
export function convertHTMLChordNotation(songText: string, centralEuropeanNotation: boolean): string {
    const parser = new DOMParser();
    let doc = parser.parseFromString(songText, 'text/html');
    doc = highlightRepetition(doc);

    // Process all chords in one go
    const chords = doc.querySelectorAll(`.chord`);

    // Create a document fragment for batch processing
    for (let i = 0; i < chords.length; i++) {
        const chord = chords[i];
        // Convert to Central European notation and format
        let convertedText = chord.textContent ?? "";
        if (centralEuropeanNotation) {
            convertedText = convertChordNotation(convertedText || '');
        }
        chord.innerHTML = formatChord(convertedText);
    }

    return doc.body.innerHTML;
}