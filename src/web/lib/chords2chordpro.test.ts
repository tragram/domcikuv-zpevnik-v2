import { describe, it, expect, vi } from "vitest";
import {
  convertToChordPro,
  isConvertibleFormat,
  normalizeChordTokens,
} from "./chords2chordpro";

// Mock the external dependency so tests remain isolated
vi.mock("~/features/SongView/utils/chordNotation", () => ({
  convertChordNotation: vi.fn((chord: string) => {
    // Simple mock behavior to simulate Czech notation conversion
    if (chord === "B") return "H";
    if (chord === "Bb") return "B";
    return chord;
  }),
}));

describe("chords2chordpro", () => {
  describe("isConvertibleFormat", () => {
    it("returns true for valid chord-and-lyrics text", () => {
      const text = `G      C\nHello world\nD      Em\nTesting this`;
      expect(isConvertibleFormat(text)).toBe(true);
    });

    it("returns false for plain lyrics without chords", () => {
      const text = `Just a normal song line\nWithout any chords anywhere`;
      expect(isConvertibleFormat(text)).toBe(false);
    });

    it("returns false if the ratio of chords to lyrics is too low", () => {
      const text = `G\nA long paragraph of lyrics\nthat goes on and on\nand doesn't have enough\nchords to be considered\na valid convertible song.`;
      expect(isConvertibleFormat(text)).toBe(false);
    });
  });

  describe("convertToChordPro", () => {
    it("converts basic chords over lyrics", () => {
      const input = `C     G \nLet it be`;
      // 'C' is at index 0 (over 'Let')
      // 'G' is at index 7 (over the 'b' in 'be', since 'be' starts at 7)
      const expected = `{start_of_verse}\n[C]Let it [G]be\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("correctly adjust chords to starts of words when near the start", () => {
      const input = `C      G\nLet it be`;
      // 'C' is at index 0 (over 'Let')
      // 'G' is at index 8 (over the 'e' in 'be', since 'be' starts at 7)
      const expected = `{start_of_verse}\n[C]Let it [G]be\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("handles standalone chord lines (e.g., intros without lyrics)", () => {
      const input = `[Intro]\nG  C  D  G\n\n`;
      const expected = `{start_of_verse: Intro}\n[G]  [C]  [D]  [G]\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and wraps numbered verses", () => {
      const input = `\nG\n1. Verse one`;
      const expected = `{start_of_verse}\n[G]Verse one\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and wraps choruses denoted by 'Chorus:'", () => {
      const input = `\nD\nChorus: Singing loud`;
      const expected = `{start_of_chorus}\n[D]Singing loud\n{end_of_chorus}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and wraps choruses denoted by 'R:'", () => {
      const input = `\nD\nR: Singing loud`;
      const expected = `{start_of_chorus}\n[D]Singing loud\n{end_of_chorus}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and wraps choruses preceded by '[Chorus]'", () => {
      const input = `[Chorus]\nD\nSinging loud`;
      const expected = `{start_of_chorus}\n[D]Singing loud\n{end_of_chorus}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and formats tab blocks", () => {
      const input = `[Solo]\ne|---0---|\nB|---1---|`;
      const expected = `{comment: Solo}\n{start_of_tab}\ne|---0---|\nB|---1---|\n{end_of_tab}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("preserves trailing chords that fall after the last word", () => {
      const input = `G    C D G\nHey`;
      const expected = `{start_of_verse}\n[G]Hey [C] [D] [G]\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("correctly parses chords when there's a verse number", () => {
      const input = `   Dmi               G          C\n1. Atmosféra vánoční už mi leze krkem.`;
      const expected = `{start_of_verse}\n[Dmi]Atmosféra vánoční [G]už mi leze [C]krkem.\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("correctly parses chords even if they are offset due to verse number", () => {
      const input = `Dmi   G      Dmi   G      Dmi   A7    Dmi\n1. To ta Helpa, to ta Helpa, to je pekné mesto\n`;
      const expected = `{start_of_verse}\n[Dmi]To ta [G]Helpa, [Dmi]to ta [G]Helpa, [Dmi]to je [A7]pekné [Dmi]mesto\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("applies Czech chord notation conversion when requested", () => {
      const input = `B\nLyric`;
      const expected = `{start_of_verse}\n[H]Lyric\n{end_of_verse}`;
      // Pass 'true' to trigger convertToCzechNotation
      expect(convertToChordPro(input, true)).toBe(expected);
    });
  });

  describe("Section closing and non-overlapping", () => {
    it("splits paragraphs forcefully when an environment directive interrupts contiguous lines", () => {
      // Previously, the lack of a blank line made [Chorus] become a comment inside the verse block
      const input = `C\nLine 1\n[Chorus]\nD\nLine 2`;
      const expected = `{start_of_verse}\n[C]Line 1\n{end_of_verse}\n\n{start_of_chorus}\n[D]Line 2\n{end_of_chorus}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("does not incorrectly split on a chord line enclosed in parentheses", () => {
      // Sometimes standard chord lines appear in brackets and shouldn't act as block directives
      const input = `C\nLine 1\n(D)\nLine 2`;
      const expected = `{start_of_verse}\n[C]Line 1\n[D]Line 2\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("ensures tab environments strictly open and close independently from verse bodies", () => {
      const input = `Verse\n[Solo]\ne|---0---|\nB|---1---|`;
      const expected = `{start_of_verse}\nVerse\n{end_of_verse}\n\n{comment: Solo}\n{start_of_tab}\ne|---0---|\nB|---1---|\n{end_of_tab}`;
      expect(convertToChordPro(input)).toBe(expected);
    });
  });

  describe("normalizeChordTokens", () => {
    it("strips trailing punctuation from chords", () => {
      const tokens = [{ text: "C.,", position: 0 }];
      const normalized = normalizeChordTokens(tokens);
      expect(normalized[0].text).toBe("C");
    });
  });
});
