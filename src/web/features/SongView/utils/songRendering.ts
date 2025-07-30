import {
  ChordProParser,
  FormatterSettings,
  HtmlFormatter,
} from "chordproject-parser";
import memoize from "memoize-one";
import { Key } from "~/types/musicTypes";
import { SongData } from "~/types/songData";
import { convertHTMLChordNotation } from "./chordNotation";
import { postProcessChordPro } from "./postProcessing";
import {
  czechToEnglish,
  preparseDirectives,
  transposeChordPro,
} from "./preparseChordpro";
/**
 * Default section directives
 */
const DEFAULT_SECTION_DIRECTIVES = ["chorus", "bridge", "verse"];
const DEFAULT_SECTION_LABELS = ["R", "B", ""];

/**
 * Default section classes used in rendering
 */
const DEFAULT_RENDERED_SECTIONS = [
  "verse-section",
  "chorus-section",
  "bridge-section",
];

/**
 * Parses ChordPro format content with various transformations
 * @param chordProContent - Raw ChordPro content
 * @param songKey - The song's key
 * @param transposeSteps - Number of semitones to transpose
 * @returns Parsed song object
 */
function parseChordPro(
  chordProContent: string,
  songKey?: Key,
  transposeSteps?: number
) {
  // Use memoized function to avoid repeated processing
  const memoizedCzechToEnglish = memoize(czechToEnglish);
  const withEnglishChords = memoizedCzechToEnglish(chordProContent);

  // Process the directive sections
  const preparsedContent = preparseDirectives(
    withEnglishChords,
    DEFAULT_SECTION_DIRECTIVES,
    DEFAULT_SECTION_LABELS
  );
  // Transpose the song if needed
  const transposedContent = transposeChordPro(
    preparsedContent,
    songKey,
    transposeSteps ?? 0
  );

  // Parse the processed content
  const parser = new ChordProParser();
  return parser.parse(transposedContent);
}

/**
 * Attempts to determine the key of a song from its ChordPro content
 * @param chordProContent - ChordPro content to analyze
 * @returns Detected key or undefined
 */
export function guessKey(chordProContent: string): Key | undefined {
  const song = parseChordPro(chordProContent, undefined, 0);
  const possibleKey = song.getPossibleKey()?.toString() || "";
  return Key.parse(possibleKey, false);
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
  centralEuropeanNotation: boolean
): string {
  console.log(songData.chordpro)
  // Parse and process the chord pro content
  const song = parseChordPro(songData.chordpro, songData.key, transposeSteps);
  // Configure formatter settings
  const settings = new FormatterSettings();
  settings.showMetadata = false;

  // Format the song to HTML
  const formatter = new HtmlFormatter(settings);
  let songText = formatter.format(song).join("\n");

  // Apply Central European notation if requested
  songText = convertHTMLChordNotation(songText, centralEuropeanNotation);

  // Process repetitions
  return postProcessChordPro(songText, DEFAULT_RENDERED_SECTIONS);
}
