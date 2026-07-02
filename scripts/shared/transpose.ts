/**
 * Chord/key transposition for the backfill scripts, reusing the app's own logic
 * (chordsheetjs + musicTypes + convertChordNotation) so results match the editor.
 *
 * Stored chordpro has no {key}/{capo} preamble (those are DB columns), so here we
 * only transpose the inline [chords]; key/range/startMelody columns are handled
 * separately by the helpers below.
 */
import ChordSheetJS from "chordsheetjs";
import { convertChordNotation } from "../../src/lib/utils";
import { Key, Note, SongRange } from "../../src/web/types/musicTypes";

/** Transpose every inline [chord] in the chordpro by `steps` semitones. */
export function transposeChords(content: string, steps: number): string {
  if (!steps) return content;
  return content.replace(/\[([^\]]+)\]/g, (match, chord: string) => {
    // Convert Czech notation to English purely for the parser (B→Bb, H→B).
    const engChord = chord.replace(/B/g, "Bb").replace(/H/g, "B");
    const parsed = ChordSheetJS.Chord.parse(engChord);
    if (!parsed) return match;
    const czech = parsed
      .transpose(steps)
      .normalize()
      .toString()
      .split("/")
      .map((part: string) => convertChordNotation(part))
      .join("/");
    return `[${czech}]`;
  });
}

/** Signed, minimal semitone delta from `fromKey` to `toKey` (Czech notation). */
export function keyStepsBetween(fromKey: string, toKey: string): number | null {
  const a = Key.parse(fromKey, true);
  const b = Key.parse(toKey, true);
  if (!a || !b) return null;
  let d = (b.note.getSemitoneValue() - a.note.getSemitoneValue()) % 12;
  if (d < 0) d += 12;
  if (d > 6) d -= 12; // take the shorter direction (e.g. +7 -> -5)
  return d;
}

/** Best-effort source key from the first inline chord, when no key is stored. */
export function guessKeyFromChords(content: string): string | null {
  const m = content.match(/\[([A-Ha-h][#b]?)(mi|min|m)?/);
  if (!m) return null;
  const root = m[1].toUpperCase();
  const minor = m[2] ? "m" : "";
  const parsed = Key.parse(root + minor, true);
  return parsed ? parsed.toString() : null;
}

/** Transpose a `range` column value (e.g. "c1-g2"); returns input on failure. */
export function transposeRangeValue(range: string | null, steps: number): string | null {
  if (!range || !steps) return range;
  try {
    const r = new SongRange(range);
    if (r.min && r.max) return r.toString(steps, false);
  } catch {
    /* leave unchanged on parse failure */
  }
  return range;
}

/** Transpose a `startMelody` column value (e.g. "c# d e"). */
export function transposeStartMelodyValue(sm: string | null, steps: number): string | null {
  if (!sm || !steps) return sm;
  return sm.replace(
    /(^|[\s,]+)([a-hA-H][#b]?)([0-9]*)(?=[\s,]|$)/g,
    (noteMatch: string, prefix: string, nStr: string, oct: string) => {
      try {
        const note = Note.parse(nStr, true);
        if (note) {
          const isUpper = nStr[0] === nStr[0].toUpperCase();
          const t = note.transposed(steps).toString("sharp", true);
          return prefix + (isUpper ? t : t.toLowerCase()) + oct;
        }
      } catch {
        /* leave this token unchanged */
      }
      return noteMatch;
    },
  );
}
