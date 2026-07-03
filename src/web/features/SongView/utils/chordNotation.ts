import { convertChordNotation } from "src/lib/utils";

/**
 * Maps for chord name conversion and substitution
 */
const CHORD_NOTATION_MAP = {
  b: "♭",
  "#": "♯",
};

const CHORD_MODIFIER_REGEX = /(♯|♭|2|4|6|7|9|maj|sus|dim|\+|\([^()]*\))/g;

/**
 * Formats a chord with proper notation and superscripts
 * @param chordText - The chord text to format
 * @param centralEuropeanNotation - Whether to use Central European notation (H/B system)
 * @returns Formatted chord HTML
 */
export function formatChord(chordText: string): string {
  if (!chordText) return "";

  let formatted = chordText;

  // --- Opinionated naming fixes ---
  // Restore sus4 (only if it's just 'sus' and not 'sus2')
  formatted = formatted.replace(/sus(?![24])/g, "sus4");
  // Restore maj7
  formatted = formatted.replace(/ma7/g, "maj7");

  // Replace flat and sharp signs
  for (const [symbol, replacement] of Object.entries(CHORD_NOTATION_MAP)) {
    formatted = formatted.replace(new RegExp(symbol, "g"), replacement);
  }

  // Add superscript to modifiers
  return formatted.replace(CHORD_MODIFIER_REGEX, "<sup>$1</sup>");
}
/**
 * Converts chord notation in HTML to Central European notation and adds formatting
 * @param songText - HTML song text to process
 * @returns Processed HTML with converted chord notation
 */
export function convertHTMLChordNotation(
  songText: string,
  centralEuropeanNotation: boolean,
): string {
  const parser = new DOMParser();
  songText = songText
    .replaceAll("𝄆", `<span class="repetition">𝄆</span>`)
    .replaceAll("𝄇", `<span class="repetition">𝄇</span>`);
  const doc = parser.parseFromString(songText, "text/html");

  // Process all chords in one go
  const chords = doc.querySelectorAll(`.chord`);

  // Create a document fragment for batch processing
  for (let i = 0; i < chords.length; i++) {
    const chord = chords[i];
    // Convert to Central European notation and format
    let convertedText = chord.textContent ?? "";
    if (centralEuropeanNotation) {
      convertedText = convertChordNotation(convertedText || "");
    }
    chord.innerHTML = formatChord(convertedText);
  }

  return doc.body.innerHTML;
}
