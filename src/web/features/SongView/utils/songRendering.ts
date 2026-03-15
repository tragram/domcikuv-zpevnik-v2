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
 * Attempts to determine the key of a song from its ChordPro content
 */
export function guessKey(chordProContent: string): Key | undefined {
  const song = parseChordPro(chordProContent);
  //TODO: actual guess
  const possibleKey = song.metadata?.key || "";
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
  centralEuropeanNotation: boolean,
): string {
  // Parse and process the chord pro content
  let song = parseChordPro(formatChordpro(songData.chordpro));
  console.log(song);
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
