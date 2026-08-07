export const LAYOUT_PRESSURE_BASE_FONT_SIZE = 16;

export type LayoutPressureTextStyle =
  | "lyrics"
  | "chorus"
  | "chord";

export type LayoutPressureTextMeasurer = (
  text: string,
  style: LayoutPressureTextStyle,
) => number;

export interface SongLayoutPressure {
  /** Estimated width of the widest rendered row, normalized to the base font. */
  widestRowEm: number;
  /** Content rows plus collapsed blank separators and section recalls. */
  visibleRows: number;
  /** Original source line responsible for `widestRowEm`. */
  widestLine: string;
}

const SECTION_DIRECTIVES = new Set(["chorus", "bridge", "verse", "interlude"]);
const METADATA_DIRECTIVES = new Set([
  "artist",
  "a",
  "capo",
  "key",
  "language",
  "range",
  "startmelody",
  "tempo",
  "title",
  "t",
]);

const CHORUS_PADDING_EM = 1.2;

interface ParsedDirective {
  name: string;
  value: string;
}

function parseDirective(line: string): ParsedDirective | null {
  const match = line.trim().match(/^\{([^}:]+)(?::\s*([^}]*))?\}$/);
  if (!match) return null;
  return {
    name: match[1].trim().toLowerCase(),
    value: (match[2] ?? "").trim(),
  };
}

function stripInlineDirectives(line: string): string {
  return line.replace(/\{[^}]*\}/g, "").trimEnd();
}

/**
 * Estimates the width of the flex cells produced by ChordSheetJS for one row.
 * Each `[chord]lyrics` cell is as wide as its wider child.
 */
function measureChordProRow(
  line: string,
  lyricStyle: "lyrics" | "chorus",
  measureText: LayoutPressureTextMeasurer,
): number {
  const chordPattern = /\[([^\]]*)\]/g;
  const chords = [...line.matchAll(chordPattern)];
  if (chords.length === 0) return measureText(line, lyricStyle);

  let width = 0;
  const prefix = line.slice(0, chords[0].index);
  if (prefix) width += measureText(prefix, lyricStyle);

  for (let index = 0; index < chords.length; index++) {
    const chord = chords[index][1];
    const lyricStart = chords[index].index! + chords[index][0].length;
    const lyricEnd = chords[index + 1]?.index ?? line.length;
    const lyric = line.slice(lyricStart, lyricEnd);
    width += Math.max(
      measureText(chord, "chord"),
      measureText(lyric, lyricStyle),
    );
  }

  return width;
}

/**
 * Produces a cheap layout-pressure proxy without ChordSheetJS or DOM rendering.
 * Widths returned by `measureText` are expected to use the 16px base fonts used
 * by `createCanvasLayoutPressureMeasurer`.
 */
export function analyzeSongLayoutPressure(
  chordpro: string,
  measureText: LayoutPressureTextMeasurer,
): SongLayoutPressure {
  let widestRowPx = 0;
  let widestLine = "";
  let visibleRows = 0;
  let hasVisibleRow = false;
  let pendingBlankSeparator = false;
  let activeSection: string | null = null;
  let inTab = false;

  const addRow = (sourceLine: string, widthPx: number) => {
    if (pendingBlankSeparator && hasVisibleRow) visibleRows += 1;
    pendingBlankSeparator = false;
    hasVisibleRow = true;
    visibleRows += 1;

    if (widthPx > widestRowPx) {
      widestRowPx = widthPx;
      widestLine = sourceLine.trim();
    }
  };

  for (const sourceLine of chordpro.split(/\r?\n/)) {
    const trimmed = sourceLine.trim();
    if (!trimmed) {
      if (hasVisibleRow) pendingBlankSeparator = true;
      continue;
    }

    const directive = parseDirective(sourceLine);
    if (directive) {
      if (directive.name === "start_of_tab") {
        inTab = true;
        continue;
      }
      if (directive.name === "end_of_tab") {
        inTab = false;
        continue;
      }

      const sectionStart = directive.name.match(/^start_of_(.+)$/)?.[1];
      if (sectionStart) {
        activeSection = sectionStart;
        continue;
      }
      if (directive.name.startsWith("end_of_")) {
        activeSection = null;
        continue;
      }

      if (directive.name === "comment" || directive.name === "c") {
        if (directive.value) {
          // Comments wrap within the paragraph max-width, so they contribute
          // height but do not establish the fitted content width.
          addRow(sourceLine, 0);
        }
        continue;
      }

      if (SECTION_DIRECTIVES.has(directive.name)) {
        // Collapsed recall labels are rendered through the same wrapping
        // comment path.
        addRow(sourceLine, 0);
        continue;
      }

      if (METADATA_DIRECTIVES.has(directive.name)) continue;
      // Other standalone directives affect parsing or presentation but do not
      // provide a reliable source-level row to measure.
      continue;
    }

    const content = stripInlineDirectives(sourceLine);
    if (!content) continue;

    if (inTab) {
      // Tabs scroll horizontally in SongView, so their width does not constrain
      // the fitted font size. They still consume vertical space.
      addRow(sourceLine, 0);
      continue;
    }

    const lyricStyle = activeSection === "chorus" ? "chorus" : "lyrics";
    let widthPx = measureChordProRow(content, lyricStyle, measureText);
    if (lyricStyle === "chorus") {
      widthPx += CHORUS_PADDING_EM * LAYOUT_PRESSURE_BASE_FONT_SIZE;
    }
    addRow(sourceLine, widthPx);
  }

  return {
    widestRowEm: widestRowPx / LAYOUT_PRESSURE_BASE_FONT_SIZE,
    visibleRows,
    widestLine,
  };
}

const FONT_BY_STYLE: Record<LayoutPressureTextStyle, string> = {
  lyrics: `600 ${LAYOUT_PRESSURE_BASE_FONT_SIZE}px Poppins, sans-serif`,
  chorus: `700 ${LAYOUT_PRESSURE_BASE_FONT_SIZE}px Poppins, sans-serif`,
  chord: `800 ${LAYOUT_PRESSURE_BASE_FONT_SIZE}px Poppins, sans-serif`,
};

/** Creates a browser text measurer using the same font families as SongView. */
export function createCanvasLayoutPressureMeasurer(): LayoutPressureTextMeasurer | null {
  if (typeof document === "undefined") return null;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return null;

  const cache = new Map<string, number>();
  return (text, style) => {
    if (!text) return 0;
    const key = `${style}\u0000${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    context.font = FONT_BY_STYLE[style];
    const width = context.measureText(text).width;
    // Bound memory for long-lived admin sessions. Common chord and lyric
    // fragments are still reused heavily between resets.
    if (cache.size >= 50_000) cache.clear();
    cache.set(key, width);
    return width;
  };
}
