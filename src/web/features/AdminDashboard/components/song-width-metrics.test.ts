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
  it("models a ChordPro row as chord/lyric cells", () => {
    const pressure = analyzeSongLayoutPressure(
      "[C]Hi [Long]x",
      measureByCharacter,
    );

    // max(C=2em, "Hi "=3em) + max(Long=8em, x=1em)
    expect(pressure.widestRowEm).toBe(11);
    expect(pressure.visibleRows).toBe(1);
    expect(pressure.widestLine).toBe("[C]Hi [Long]x");
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
  });
});
