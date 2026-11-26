import { Chord } from "chordsheetjs";
import { convertChordNotation } from "src/lib/utils";
import { Key, Note, SongRange } from "~/types/musicTypes";
import type { EditorState } from "~/types/types";
import { guessKey } from "../SongView/utils/songRendering";
import { parseMetadataFromChordPro } from "./editor-state";

function transposeCapo(capo: number, steps: number) {
  const fret = (capo - steps) % 12;
  return fret < 0 ? fret + 12 : fret;
}

function transposeRange(value: string, steps: number) {
  try {
    const range = new SongRange(value);
    if (range.min && range.max) return range.toString(steps, false);
  } catch {
    // An unfinished range may contain an unparseable note.
  }
  return undefined;
}

function transposeMelody(value: string, steps: number) {
  return value.replace(/(^|[\s,]+)([a-hA-H][#b]?)([0-9]*)(?=[\s,]|$)/g,
    (match, prefix: string, spelling: string, octave: string) => {
      try {
        const note = Note.parse(spelling, true);
        if (note) {
          const name = note.transposed(steps).toString("sharp", true);
          return prefix + (spelling[0] === spelling[0].toLowerCase() ? name.toLowerCase() : name) + octave;
        }
      } catch {
        // Keep unsupported spellings as typed.
      }
      return match;
    });
}

export function transposeDraft(draft: EditorState, steps: -1 | 1): EditorState {
  const songKey = guessKey(draft.chordpro) ?? Key.parse("C");
  if (!songKey) return draft;

  const chordpro = draft.chordpro
    .replace(/\{key:\s*([^}]+)\}/i, "{key: " + convertChordNotation(songKey.transposed(steps).toString()) + "}")
    .replace(/\{capo:\s*([^}]+)\}/i, (match, value: string) => {
      const capo = parseInt(value.trim(), 10);
      return Number.isNaN(capo) ? match : "{capo: " + transposeCapo(capo, steps) + "}";
    })
    .replace(/\{range:\s*([^}]+)\}/i, (match, value: string) => {
      const range = transposeRange(value, steps);
      return range === undefined ? match : "{range: " + range + "}";
    })
    .replace(/\{startmelody:\s*([^}]+)\}/i, (_, value: string) => "{startmelody: " + transposeMelody(value, steps) + "}")
    .replace(/\[([^\]]+)\]/g, (match, value: string) => {
      const chord = Chord.parse(value.replace(/B/g, "Bb").replace(/H/g, "B"));
      if (!chord) return match;
      const names = chord.transpose(steps).normalize().toString().split("/");
      return "[" + names.map(convertChordNotation).join("/") + "]";
    });

  const directives = parseMetadataFromChordPro(draft.chordpro);
  const next = { ...draft, ...parseMetadataFromChordPro(chordpro), chordpro };
  if (draft.key && directives.key === undefined) {
    try {
      const key = Key.parse(draft.key, true);
      if (key) next.key = convertChordNotation(key.transposed(steps).toString());
    } catch {
      // Leave an unfinished manual key as entered.
    }
  }
  if (draft.capo != null && draft.capo !== "" && directives.capo === undefined) {
    next.capo = transposeCapo(Number(draft.capo), steps);
  }
  if (draft.range && directives.range === undefined) {
    next.range = transposeRange(draft.range, steps) ?? draft.range;
  }
  if (draft.startMelody && directives.startMelody === undefined) {
    next.startMelody = transposeMelody(draft.startMelody, steps);
  }
  return next;
}
