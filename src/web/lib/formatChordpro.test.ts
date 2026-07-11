import { describe, it, expect } from "vitest";
import { formatChordpro } from "./formatChordpro"; // Adjust the import path if necessary

describe("formatChordpro", () => {
  describe("Whitespace handling", () => {
    it("should remove leading, trailing, and excessive internal spaces", () => {
      const input = "   [C]    this   is   spaced   ";
      const expected = "[C]This is spaced";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should remove spaces immediately following a closing chord bracket", () => {
      const input = "[C] hello [G] world";
      const expected = "[C]Hello [G]world";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should add a space between a closing bracket and the repetition end marker (𝄇)", () => {
      const input = "[C]𝄇";
      const expected = "[C] 𝄇";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should keep an existing single space before the repetition end marker", () => {
      const input = "[C] 𝄇";
      expect(formatChordpro(input)).toBe("[C] 𝄇");
    });

    it("should handle empty input", () => {
      expect(formatChordpro("")).toBe("");
    });
  });

  describe("Repetitions handling", () => {
    it("should replace |: :| with musical repetition markers", () => {
      const input = "|: repeat this section :|";
      const expected = "𝄆 Repeat this section 𝄇";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should replace /: :/ with musical repetition markers", () => {
      const input = "/: repeat this section :/";
      const expected = "𝄆 Repeat this section 𝄇";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("shouldn't replace mixed /: :| with musical repetition markers", () => {
      const input = "/: repeat this section :|";
      const expected = "/: repeat this section :|";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should trim excess spaces inside repetition markers", () => {
      const input = "|:   spaced repetition   :|";
      const expected = "𝄆 Spaced repetition 𝄇";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should support repetition markers spanning multiple lines", () => {
      const input = "|: line one\nline two :|";
      const expected = "𝄆 Line one\nline two 𝄇";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should replace multiple repetitions on the same line independently", () => {
      const input = "|: first :| and |: second :|";
      const expected = "𝄆 First 𝄇 and 𝄆 second 𝄇";
      expect(formatChordpro(input)).toBe(expected);
    });
  });

  describe("Lyrics capitalization (Paragraph based)", () => {
    it("should ONLY capitalize the first letter of the first line in a paragraph", () => {
      const input = "hello world\ngoodbye world\nand another line";
      const expected = "Hello world\ngoodbye world\nand another line";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should reset capitalization after an empty line (new paragraph)", () => {
      const input =
        "first paragraph line\nsecond paragraph line\n\nnew paragraph line\nanother line";
      const expected =
        "First paragraph line\nsecond paragraph line\n\nNew paragraph line\nanother line";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should handle chordpro directives correctly without consuming the paragraph capitalization", () => {
      const input = "{c: Chorus}\n[C]here we go\n[G]and the next line";
      const expected = "{c: Chorus}\n[C]Here we go\n[G]and the next line";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should correctly capitalize when multiple chords precede the lyrics on the first line", () => {
      const input = "[C][G][Am]here we go\nthen this happens";
      const expected = "[C][G][Am]Here we go\nthen this happens";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should not let a chords-only line consume the paragraph capitalization", () => {
      const input = "[C][G]\nhello there";
      const expected = "[C][G]\nHello there";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should capitalize accented characters", () => {
      expect(formatChordpro("čau, jak se máš?")).toBe("Čau, jak se máš?");
    });

    it("should be idempotent", () => {
      const input = "  [C]  hello   world [G]𝄇\n\n|: another   line :|";
      const once = formatChordpro(input);
      expect(formatChordpro(once)).toBe(once);
    });
  });

  describe("Tab section protection", () => {
    it("should not format or capitalize text inside {start_of_tab} and {end_of_tab}", () => {
      const input = `{start_of_tab}
e|---0---|
B|---1---|
g|---0---|
{end_of_tab}

[C]lyrics start here
and continue here`;

      const expected = `{start_of_tab}
e|---0---|
B|---1---|
g|---0---|
{end_of_tab}

[C]Lyrics start here
and continue here`;

      expect(formatChordpro(input)).toBe(expected);
    });

    it("should preserve whitespace alignment inside tab sections", () => {
      const input = "{start_of_tab}\ne|--0--    3x--|\n  B|--1--|\n{end_of_tab}";
      expect(formatChordpro(input)).toBe(input);
    });

    it("should not convert |: :| repeat marks inside tab sections", () => {
      const input = "{start_of_tab}\ne|:--0--:|\n{end_of_tab}";
      expect(formatChordpro(input)).toBe(input);
    });

    it("should not mangle tab content containing dollar signs", () => {
      const input = "{start_of_tab}\nplay $& then $1\n{end_of_tab}";
      expect(formatChordpro(input)).toBe(input);
    });

    it("should capitalize the first lyric line following a tab block in the same paragraph", () => {
      const input = "{start_of_tab}\ne|--0--|\n{end_of_tab}\nlyrics here";
      const expected = "{start_of_tab}\ne|--0--|\n{end_of_tab}\nLyrics here";
      expect(formatChordpro(input)).toBe(expected);
    });

    it("should restore multiple tab sections in order", () => {
      const input =
        "{start_of_tab}\ne|--1--|\n{end_of_tab}\nsome lyrics\n{start_of_tab}\ne|--2--|\n{end_of_tab}";
      const expected =
        "{start_of_tab}\ne|--1--|\n{end_of_tab}\nSome lyrics\n{start_of_tab}\ne|--2--|\n{end_of_tab}";
      expect(formatChordpro(input)).toBe(expected);
    });
  });
});
