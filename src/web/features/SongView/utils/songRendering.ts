import ChordSheetJS from "chordsheetjs";
import memoize from "memoize-one";
import { SongData } from "~/types/songData";
import { convertHTMLChordNotation } from "./chordNotation";
import { postProcessChordPro } from "./postProcessing";
import { czechToEnglish, preparseDirectives } from "./preparseChordpro";
import { formatChordpro } from "~/lib/formatChordpro";
import { Key, KeyMode } from "~/types/musicTypes";

/**
 * Default section classes used by chordsheetjs
 */
const DEFAULT_RENDERED_SECTIONS = ["verse", "chorus", "bridge"];

/**
 * Parses ChordPro format content with various transformations
 * @param chordProContent - Raw ChordPro content
 * @param songKey - The song's key
 * @param transposeSteps - Number of semitones to transpose
 * @returns Parsed song object
 */
function parseChordPro(chordProContent: string) {
  const memoizedCzechToEnglish = memoize(czechToEnglish);
  const withEnglishChords = memoizedCzechToEnglish(chordProContent);

  // Process the directive sections
  const preparsedContent = preparseDirectives(withEnglishChords);

  // Parse using ChordSheetJS
  const parser = new ChordSheetJS.ChordProParser();
  return parser.parse(preparsedContent);
}

/**
 * Extracts the root and quality (major/minor) from a raw chord string.
 * Uses the character class logic from preparseChordpro.ts
 * e.g., "Cmaj7" -> "C", "F#m7" -> "F#m", "G/B" -> "G"
 */
function extractBaseKey(rawChord: string): string | null {
  // Matches A-G, optional # or b, optional m or min (for minor)
  const match = rawChord.match(/^([A-G][#b]?)(m(?:in)?(?![a-z]))?/i);
  if (match) {
    const root = match[1].toUpperCase();
    const isMinor = match[2] ? "m" : "";
    return `${root}${isMinor}`;
  }
  return null;
}

/**
 * Attempts to determine the key of a song from its ChordPro content
 * using a weighted scoring system based on chord frequency and structure.
 */
export function guessKey(chordProContent: string): Key | undefined {
  // 1. Check explicit metadata first (fastest and most accurate)
  const keyMetaMatch = chordProContent.match(/\{key:\s*([^}]+)\}/i);
  if (keyMetaMatch) {
    const parsedKey = Key.parse(keyMetaMatch[1].trim(), false);
    if (parsedKey) return parsedKey;
  }

  // 2. Pre-process to ensure English notation (H -> B, etc.)
  const englishContent = czechToEnglish(chordProContent);

  // 3. Extract all chords using the bracket matching logic from preparseChordpro
  // Matches anything starting with A-G inside brackets, allowing extensions
  const chordRegex = /\[([A-G][A-Za-z\d#b,\s/]{0,15})\]/gi;
  const chords: string[] = [];
  let match;

  while ((match = chordRegex.exec(englishContent)) !== null) {
    const baseChord = extractBaseKey(match[1]);
    if (baseChord) {
      chords.push(baseChord);
    }
  }

  if (chords.length === 0) return undefined;

  // 4. Elaborate Guessing Logic (Scoring System)
  const chordScores: Record<string, number> = {};

  // Score A: Frequency (1 point per occurrence)
  chords.forEach((chord) => {
    chordScores[chord] = (chordScores[chord] || 0) + 1;
  });

  // Score B: Structural Start (First chord gets +3 points)
  const firstChord = chords[0];
  chordScores[firstChord] = (chordScores[firstChord] || 0) + 3;

  // Score C: Structural Resolution (Last chord gets +5 points)
  const lastChord = chords[chords.length - 1];
  chordScores[lastChord] = (chordScores[lastChord] || 0) + 5;

  // 5. Determine the highest scoring chord
  let bestGuess = "";
  let highestScore = -1;

  for (const [chord, score] of Object.entries(chordScores)) {
    if (score > highestScore) {
      highestScore = score;
      bestGuess = chord;
    }
  }

  return bestGuess ? Key.parse(bestGuess, false) : undefined;
}

/**
 * Renders a song with specified formatting options
 * @param songData - Song data to render
 * @param transposeSteps - Number of semitones to transpose
 * @param repeatChorus - Whether to repeat chorus sections
 * @param centralEuropeanNotation - Whether to use Central European notation (H/B system)
 * @returns Rendered HTML
 */
export function renderSong(
  songData: SongData,
  transposeSteps: number,
  centralEuropeanNotation: boolean,
): string {
  // Parse and process the chord pro content
  let song = parseChordPro(formatChordpro(songData.chordpro));
  // Inject known key to help the transposer pick sharp/flat accidentals properly
  if (songData.key) {
    const isFlat = songData.key.isFlat();
    // Format the note (specifying flat/sharp and disabling Czech notation for the parser)
    const noteStr = songData.key.note.toString(
      isFlat ? "flat" : "sharp",
      false,
    );
    // Append 'm' for minor keys
    const modeStr = songData.key.mode === KeyMode.Minor ? "m" : "";

    // chordsheetjs Song objects are immutable, so we reassign using setKey
    song = song.setKey(noteStr + modeStr);
  }

  // Use ChordSheetJS native transposition
  if (transposeSteps !== 0) {
    song = song.transpose(transposeSteps);
  }

  // Format the song to HTML using Div Formatter
  const formatter = new ChordSheetJS.HtmlDivFormatter();
  let songText = formatter.format(song);

  // Apply Central European notation if requested
  songText = convertHTMLChordNotation(songText, centralEuropeanNotation);

  // Process repetitions
  return postProcessChordPro(songText, DEFAULT_RENDERED_SECTIONS);
}
