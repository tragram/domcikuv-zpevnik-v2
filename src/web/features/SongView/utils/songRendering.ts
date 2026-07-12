// Named imports (not the default export) so unused chordsheetjs classes can be
// tree-shaken — the default export retains the whole 3 MB bundle (PdfFormatter
// fonts, ChordsOverWords parser, jspdf...).
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import DOMPurify from "dompurify";
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
const DEFAULT_RENDERED_SECTIONS = ["verse", "chorus", "bridge", "interlude"];

// Module-level so the last-args cache survives across renders of the same song
// (e.g. repeated transposition); a per-call memoize would never hit
const memoizedCzechToEnglish = memoize(czechToEnglish);

/**
 * Parses ChordPro format content with various transformations
 * @param chordProContent - Raw ChordPro content
 * @param songKey - The song's key
 * @param transposeSteps - Number of semitones to transpose
 * @returns Parsed song object
 */
function parseChordPro(chordProContent: string) {
  const withEnglishChords = memoizedCzechToEnglish(chordProContent);

  // Process the directive sections
  const preparsedContent = preparseDirectives(withEnglishChords);

  // Parse using ChordSheetJS
  const parser = new ChordProParser();
  return parser.parse(preparsedContent);
}

/**
 * Extracts root + quality from a raw chord string, e.g. "Cmaj7" → "C",
 * "F#m7" → "F#m", "Bbm" → "Bbm". Only the letter is uppercased so that
 * flat accidentals (lowercase 'b') are preserved — "Bb" must not become "BB".
 */
function extractBaseKey(rawChord: string): string | null {
  const match = rawChord.match(/^([A-G])([#b]?)(m(?:in)?(?![a-z]))?/i);
  if (!match) return null;
  const root = match[1].toUpperCase() + match[2];
  const isMinor = match[3] ? "m" : "";
  return root + isMinor;
}

/**
 * Returns the key of a song from its ChordPro content.
 * Checks the explicit {key:} directive first; otherwise uses the first chord.
 * Keys derived from flat-notation chords (e.g. Db) are stored internally by
 * semitone value and serialised back via sharp notation (C#), so the renderer
 * always prefers sharps unless the song explicitly declares a flat key.
 */
export function guessKey(chordProContent: string): Key | undefined {
  // 1. Explicit {key:} directive wins immediately
  const keyMetaMatch = chordProContent.match(/\{key:\s*([^}]+)\}/i);
  if (keyMetaMatch) {
    const parsedKey = Key.parse(keyMetaMatch[1].trim(), false);
    if (parsedKey) return parsedKey;
  }

  // 2. Convert Czech notation (H→B, B→Bb) before extracting chords
  const englishContent = czechToEnglish(chordProContent);

  // 3. First chord is used as the key
  const chordRegex = /\[([A-G][A-Za-z\d#b,\s/]{0,15})\]/i;
  const match = chordRegex.exec(englishContent);
  if (match) {
    const baseKey = extractBaseKey(match[1]);
    if (baseKey) return Key.parse(baseKey, false);
  }

  return undefined;
}

/**
 * Renders a song with specified formatting options
 * @param songData - Song data to render
 * @param transposeSteps - Number of semitones to transpose
 * @param centralEuropeanNotation - Whether to use Central European notation (H/B system)
 * @param fallbackKey - Key to use when songData has no explicit key (songData.key wins)
 * @returns Rendered HTML
 */
export function renderSong(
  songData: SongData,
  transposeSteps: number,
  centralEuropeanNotation: boolean,
  fallbackKey?: Key,
): string {
  // Parse and process the chord pro content
  let song = parseChordPro(formatChordpro(songData.chordpro));
  // Inject known key to help the transposer pick sharp/flat accidentals properly
  const effectiveKey = songData.key ?? fallbackKey;
  if (effectiveKey) {
    const isFlat = effectiveKey.isFlat();
    // Format the note (specifying flat/sharp and disabling Czech notation for the parser)
    const noteStr = effectiveKey.note.toString(
      isFlat ? "flat" : "sharp",
      false,
    );
    // Append 'm' for minor keys
    const modeStr = effectiveKey.mode === KeyMode.Minor ? "m" : "";

    // chordsheetjs Song objects are immutable, so we reassign using setKey
    song = song.setKey(noteStr + modeStr);
  }

  // Use ChordSheetJS native transposition
  if (transposeSteps !== 0) {
    song = song.transpose(transposeSteps);
  }

  // Format the song to HTML using Div Formatter
  const formatter = new HtmlDivFormatter();
  let songText = formatter.format(song);

  // Apply Central European notation if requested
  songText = convertHTMLChordNotation(songText, centralEuropeanNotation);

  // Process repetitions
  const html = postProcessChordPro(songText, DEFAULT_RENDERED_SECTIONS);

  // This HTML is injected via dangerouslySetInnerHTML, and chordsheetjs does NOT
  // escape lyrics/comments/titles — so a crafted chordpro (which can reach other
  // users via shared songbooks, pinned drafts, and live sessions) could inject
  // active markup. Sanitize to strip <script>, event handlers, and javascript:
  // URLs while preserving the div/span/sup/sub + class structure the CSS needs.
  return DOMPurify.sanitize(html);
}
