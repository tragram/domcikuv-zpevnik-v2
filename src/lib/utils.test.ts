import { describe, expect, it } from "vitest";
import { convertChordNotation, guessLanguage } from "./utils";

describe("convertChordNotation", () => {
  it("passes through falsy input unchanged", () => {
    expect(convertChordNotation("")).toBe("");
  });

  it("converts a leading Bb to B", () => {
    expect(convertChordNotation("Bb")).toBe("B");
    expect(convertChordNotation("Bbmi7")).toBe("Bmi7");
  });

  it("converts a leading B to H", () => {
    expect(convertChordNotation("B")).toBe("H");
    expect(convertChordNotation("Bmi")).toBe("Hmi");
  });

  it("converts a trailing Bb (e.g. a slash chord bass note) to B", () => {
    expect(convertChordNotation("D/Bb")).toBe("D/B");
  });

  it("converts a trailing B to H", () => {
    expect(convertChordNotation("D/B")).toBe("D/H");
  });

  it("prefers the leading-Bb rule over the trailing-B rule for a bare Bb", () => {
    // "Bb" both starts with "Bb" and ends with "B" - the leading check wins.
    expect(convertChordNotation("Bb")).toBe("B");
  });

  it("leaves chords with no B/Bb unchanged", () => {
    expect(convertChordNotation("Ami7")).toBe("Ami7");
  });

  it("trims surrounding whitespace via the leading/trailing checks", () => {
    expect(convertChordNotation(" B ")).toBe("H");
  });
});

describe("guessLanguage", () => {
  it("detects Czech via diacritics", () => {
    expect(guessLanguage("Já bych řekl že")).toBe("czech");
  });

  it("detects English via common function words", () => {
    expect(
      guessLanguage("I know because I'm the one which would know the truth"),
    ).toBe("english");
  });

  it("detects Spanish via diacritics/keywords", () => {
    expect(guessLanguage("cuando también porque")).toBe("spanish");
  });

  it("detects Slovak via diacritics", () => {
    expect(guessLanguage("ôsmy ĺad ŕad ľan")).toBe("slovak");
  });

  it("returns undefined when nothing matches", () => {
    expect(guessLanguage("xyz 123")).toBeUndefined();
  });
});
