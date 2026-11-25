import { describe, expect, it } from "vitest";
import {
  analyzeSongLayoutPressure,
  type LayoutPressureTextMeasurer,
} from "./song-width-metrics";

const measureByCharacter: LayoutPressureTextMeasurer = (text, style) => {
  const scale = style === "chord" ? 2 : 1;
  return text.length * 16 * scale;
};

describe("analyzeSongLayoutPressure", () => {
  it("adds chords, lyrics, and chord margins in the default inline layout", () => {
    const pressure = analyzeSongLayoutPressure(
      "[C]Hi [Long]x",
      measureByCharacter,
    );

    // C=2em, "Hi "=3em, Long=8em, x=1em, plus two inline chord margins.
    expect(pressure.widestRowEm).toBeCloseTo(14.12);
    expect(pressure.visibleRows).toBe(1);
    expect(pressure.widestLine).toBe("[C]Hi [Long]x");
  });

  it("normalizes source spacing and adds the gap after an empty lyric cell", () => {
    const pressure = analyzeSongLayoutPressure("  [C]  [G]  Hi  ", measureByCharacter);

    expect(pressure.widestRowEm).toBeCloseTo(6.42);
  });

  it("uses the supplied proportional measurements instead of character count", () => {
    const proportionalMeasure: LayoutPressureTextMeasurer = (text) =>
      [...text].reduce(
        (width, character) => width + (character === "W" ? 24 : 4),
        0,
      );

    const pressure = analyzeSongLayoutPressure(
      "iiiiiiii\nWWW",
      proportionalMeasure,
    );

    expect(pressure.widestLine).toBe("WWW");
    expect(pressure.widestRowEm).toBe(4.5);
  });

  it("counts comments and recalls without letting their wrapping text set width", () => {
    const pressure = analyzeSongLayoutPressure(
      [
        "{title: Example}",
        "{start_of_verse}",
        "A lyric",
        "{end_of_verse}",
        "",
        "{comment: This deliberately very long comment wraps}",
        "{chorus}",
      ].join("\n"),
      measureByCharacter,
    );

    expect(pressure.visibleRows).toBe(4);
    expect(pressure.widestLine).toBe("A lyric");
    expect(pressure.widestRowEm).toBe(7);
  });

  it("collapses consecutive blank separators and accounts for chorus padding", () => {
    const pressure = analyzeSongLayoutPressure(
      [
        "{start_of_chorus}",
        "abcd",
        "",
        "",
        "ef",
        "{end_of_chorus}",
      ].join("\n"),
      measureByCharacter,
    );

    expect(pressure.visibleRows).toBe(3);
    expect(pressure.widestRowEm).toBeCloseTo(5.2);
  });

  it("excludes horizontally scrollable tabs from width pressure", () => {
    const pressure = analyzeSongLayoutPressure(
      "{start_of_tab}\n123456\n{end_of_tab}",
      measureByCharacter,
    );

    expect(pressure.widestRowEm).toBe(0);
    expect(pressure.visibleRows).toBe(1);
    expect(pressure.widestLine).toBe("");
    expect(pressure.widthOpportunity).toBeNull();
  });

  it("estimates the savings and identifies source lines for one or several outliers", () => {
    const single = analyzeSongLayoutPressure(
      "{title: Example}\nAAAAAAAAAA\n{comment: This is not a lyric row}\nBBBBBB\nCCCCC",
      measureByCharacter,
    );
    expect(single.widthOpportunity).toEqual({
      reductionPercent: 40,
      targetWidthEm: 6,
      lines: [{ number: 2, text: "AAAAAAAAAA" }],
      priority: null,
    });

    const several = analyzeSongLayoutPressure(
      "AAAAAAAAAA\nBBBBB\nCCCCCCCCCC\nDDDD\nEEEEE",
      measureByCharacter,
    );
    expect(several.widthOpportunity).toEqual({
      reductionPercent: 50,
      targetWidthEm: 5,
      lines: [{ number: 1, text: "AAAAAAAAAA" }, { number: 3, text: "CCCCCCCCCC" }],
      priority: null,
    });
  });

  it("leaves uniformly wide songs and songs with only one measured row unflagged", () => {
    expect(analyzeSongLayoutPressure("AAAAAAAAAAA\nBBBBBBBBBB\nCCCCCCCCCC", measureByCharacter).widthOpportunity).toBeNull();
    expect(analyzeSongLayoutPressure("AAAAAAAAAAA\n{chorus}", measureByCharacter).widthOpportunity).toBeNull();
  });

  it("ignores a large percentage difference when the width gap is small", () => {
    const pressure = analyzeSongLayoutPressure("Oh\nA", measureByCharacter);
    expect(pressure.widthOpportunity).toBeNull();
  });

  const measureRows = (...widths: number[]) => analyzeSongLayoutPressure(
    widths.map((width) => "A".repeat(width)).join("\n"),
    measureByCharacter,
  ).widthOpportunity;

  it("requires a larger percentage reduction as more lines need editing", () => {
    expect(measureRows(50, 40, 40, 40)?.lines).toHaveLength(1);
    expect(measureRows(50, 50, 50, 50, 40, 40, 40, 40)).toBeNull();
    const fourLines = measureRows(50, 50, 50, 50, 39, 39, 39, 39);
    expect(fourLines?.reductionPercent).toBeCloseTo(22);
    expect(fourLines?.lines).toHaveLength(4);
  });

  it("allows up to eight edits when at least as many lines stay intact", () => {
    const eightWide = Array<number>(8).fill(50);
    const eightNarrow = Array<number>(8).fill(31);
    expect(measureRows(...eightWide, ...eightNarrow)?.lines).toHaveLength(8);
    expect(measureRows(...eightWide, 50, ...eightNarrow, 31)).toBeNull();
    expect(measureRows(...eightWide, ...eightNarrow.slice(1))).toBeNull();
  });

  it("prioritizes wide songs with meaningful savings and ignores comfortable widths in the ranking", () => {
    const comfortable = measureRows(24, 12, 12, 12);
    const slightlyWide = measureRows(26, 13, 13, 13);
    const wide = measureRows(44, 33, 33, 33);
    expect(comfortable?.reductionPercent).toBe(50);
    expect(comfortable?.priority).toBeNull();
    expect(slightlyWide?.priority).toBe(1);
    expect(wide?.priority).toBe(5);
  });
});
