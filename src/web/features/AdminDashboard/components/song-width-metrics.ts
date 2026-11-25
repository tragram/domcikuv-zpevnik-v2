import { formatChordpro } from "~/lib/formatChordpro";
import { formatChord } from "~/features/SongView/utils/chordNotation";

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
  /** Estimated width reduction if the listed lines are shortened to targetWidthEm. */
  widthOpportunity: {
    reductionPercent: number;
    targetWidthEm: number;
    lines: { number: number; text: string }[];
    /** Excess width above the target for comfortable reading, weighted by the possible reduction. */
    priority: number | null;
  } | null;
}

const SECTION_DIRECTIVES = new Set(["chorus", "bridge", "verse", "interlude"]);
const CHORUS_PADDING_EM = 1.2;
const BETWEEN_EMPTY_CHORDS_EM = 0.3;
const INLINE_CHORD_MARGIN_EM = 0.06;
const MAX_LINES_TO_SHORTEN = 8;
const MIN_REDUCTION_PERCENT = 10;
const ADDITIONAL_LINE_PERCENTAGE_POINTS = 4;
const MIN_WIDTH_GAP_EM = 2;
export const COMFORTABLE_ROW_WIDTH_EM = 24;

interface MeasuredRow {
  widthPx: number;
  number: number;
  text: string;
}

function findWidthOpportunity(
  rows: MeasuredRow[],
): SongLayoutPressure["widthOpportunity"] {
  // Require a clear break in the widths and leave at least as many lines as we edit.
  const limit = Math.min(MAX_LINES_TO_SHORTEN, Math.floor(rows.length / 2));
  if (limit === 0) return null;

  rows.sort((a, b) => b.widthPx - a.widthPx);
  const widest = rows[0].widthPx;
  const minimumGap = MIN_WIDTH_GAP_EM * LAYOUT_PRESSURE_BASE_FONT_SIZE;
  let largestGap = 0;
  let lineCount = 0;
  for (let count = 1; count <= limit; count++) {
    const targetWidth = rows[count].widthPx;
    const gap = rows[count - 1].widthPx - targetWidth;
    const minimumReduction =
      MIN_REDUCTION_PERCENT + (count - 1) * ADDITIONAL_LINE_PERCENTAGE_POINTS;
    if (gap < minimumGap || gap <= largestGap) continue;
    if (100 * (widest - targetWidth) < widest * minimumReduction) continue;
    largestGap = gap;
    lineCount = count;
  }
  if (lineCount === 0) return null;

  const targetWidth = rows[lineCount].widthPx;
  const reduction = (widest - targetWidth) / widest;
  const excessWidthEm =
    widest / LAYOUT_PRESSURE_BASE_FONT_SIZE - COMFORTABLE_ROW_WIDTH_EM;
  return {
    reductionPercent: 100 * reduction,
    targetWidthEm: targetWidth / LAYOUT_PRESSURE_BASE_FONT_SIZE,
    lines: rows.slice(0, lineCount).map(({ number, text }) => ({ number, text })),
    priority: excessWidthEm > 0 ? excessWidthEm * reduction : null,
  };
}

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
 * Estimates a row in SongView's default inline chord mode.
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
    width += measureText(chord, "chord") + measureText(lyric, lyricStyle);
    if (chord) width += INLINE_CHORD_MARGIN_EM * LAYOUT_PRESSURE_BASE_FONT_SIZE;
    if (!lyric && index < chords.length - 1) {
      width += BETWEEN_EMPTY_CHORDS_EM * LAYOUT_PRESSURE_BASE_FONT_SIZE;
    }
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
  const measuredRows: MeasuredRow[] = [];
  const sourceLines = chordpro.split(/\r?\n/);
  let formattedLines = formatChordpro(chordpro).split(/\r?\n/);
  if (formattedLines.length !== sourceLines.length) {
    // A repeat marker can span multiple lines. Keep the editor line numbers
    // usable even when formatting such a marker changes the line count.
    formattedLines = sourceLines.map(formatChordpro);
  }

  const addRow = (lineIndex: number, widthPx: number) => {
    if (pendingBlankSeparator && hasVisibleRow) visibleRows += 1;
    pendingBlankSeparator = false;
    hasVisibleRow = true;
    visibleRows += 1;

    if (widthPx <= 0) return;
    const text = sourceLines[lineIndex].trim();
    measuredRows.push({ widthPx, number: lineIndex + 1, text });
    if (widthPx > widestRowPx) {
      widestRowPx = widthPx;
      widestLine = text;
    }
  };

  for (const [lineIndex, line] of formattedLines.entries()) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (hasVisibleRow) pendingBlankSeparator = true;
      continue;
    }

    const directive = parseDirective(line);
    if (directive) {
      if (directive.name === "start_of_tab" || directive.name === "sot") {
        inTab = true;
        continue;
      }
      if (directive.name === "end_of_tab" || directive.name === "eot") {
        inTab = false;
        continue;
      }

      const sectionStart = directive.name === "soc"
        ? "chorus"
        : directive.name.match(/^start_of_(.+)$/)?.[1];
      if (sectionStart) {
        activeSection = sectionStart;
        continue;
      }
      if (directive.name === "eoc" || directive.name.startsWith("end_of_")) {
        activeSection = null;
        continue;
      }

      if (directive.name === "comment" || directive.name === "c") {
        if (directive.value) {
          // Comments can scroll within the paragraph, so they contribute
          // height but do not establish the fitted content width.
          addRow(lineIndex, 0);
        }
        continue;
      }

      if (SECTION_DIRECTIVES.has(directive.name)) {
        addRow(lineIndex, 0);
        continue;
      }

      // Other standalone directives affect parsing or presentation but do not
      // provide a reliable source-level row to measure.
      continue;
    }

    if (trimmed.startsWith("#")) continue;
    const content = stripInlineDirectives(line);
    if (!content) continue;

    if (inTab) {
      // Tabs scroll horizontally in SongView, so their width does not constrain
      // the fitted font size. They still consume vertical space.
      addRow(lineIndex, 0);
      continue;
    }

    const lyricStyle = activeSection === "chorus" ? "chorus" : "lyrics";
    let widthPx = measureChordProRow(content, lyricStyle, measureText);
    if (lyricStyle === "chorus") {
      widthPx += CHORUS_PADDING_EM * LAYOUT_PRESSURE_BASE_FONT_SIZE;
    }
    addRow(lineIndex, widthPx);
  }

  return {
    widestRowEm: widestRowPx / LAYOUT_PRESSURE_BASE_FONT_SIZE,
    visibleRows,
    widestLine,
    widthOpportunity: findWidthOpportunity(measuredRows),
  };
}

const FONT_BY_STYLE: Record<LayoutPressureTextStyle, string> = {
  lyrics: `600 ${LAYOUT_PRESSURE_BASE_FONT_SIZE}px Poppins, sans-serif`,
  chorus: `700 ${LAYOUT_PRESSURE_BASE_FONT_SIZE}px Poppins, sans-serif`,
  chord: `800 ${LAYOUT_PRESSURE_BASE_FONT_SIZE}px Poppins, sans-serif`,
};
// Tailwind's base styles size superscripts at 75% of the parent font.
const CHORD_SUPERSCRIPT_FONT = `800 ${LAYOUT_PRESSURE_BASE_FONT_SIZE * 0.75}px Poppins, sans-serif`;

export async function loadLayoutPressureFonts() {
  if (!document.fonts) return;
  await Promise.allSettled(
    Object.values(FONT_BY_STYLE).map((font) =>
      document.fonts.load(font, "Příliš žluťoučký kůň úpěl ďábelské ódy"),
    ),
  );
}

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

    let width = 0;
    if (style === "chord") {
      const parts = formatChord(text).split(/<sup>(.*?)<\/sup>/g);
      for (const [index, part] of parts.entries()) {
        if (!part) continue;
        context.font = index % 2 === 0 ? FONT_BY_STYLE.chord : CHORD_SUPERSCRIPT_FONT;
        width += context.measureText(part).width;
      }
    } else {
      context.font = FONT_BY_STYLE[style];
      width = context.measureText(text).width;
    }
    // Bound memory for long-lived admin sessions. Common chord and lyric
    // fragments are still reused heavily between resets.
    if (cache.size >= 50_000) cache.clear();
    cache.set(key, width);
    return width;
  };
}
