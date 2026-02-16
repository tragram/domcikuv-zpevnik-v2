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
      const input = `C       G\nLet it be`;
      // 'C' is at index 0 (over 'Let')
      // 'G' is at index 8 (over the 'e' in 'be', since 'be' starts at 7)
      const expected = `{start_of_verse}\n[C]Let it [G]be\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("handles standalone chord lines (e.g., intros without lyrics)", () => {
      const input = `[Intro]\nG  C  D  G`;
      const expected = `{start_of_verse: Intro}\n[G]  [C]  [D]  [G]\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and wraps numbered verses", () => {
      const input = `1.\nG\nVerse one`;
      const expected = `{start_of_verse: 1.}\n[G]Verse one\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and wraps choruses", () => {
      const input = `Chorus:\nD\nSinging loud`;
      const expected = `{start_of_chorus}\n[D]Singing loud\n{end_of_chorus}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("identifies and formats tab blocks", () => {
      const input = `[Solo]\ne|---0---|\nB|---1---|`;
      const expected = `{comment: Solo}\n{start_of_tab}\ne|---0---|\nB|---1---|\n{end_of_tab}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("snaps chords to the start of short words", () => {
      // 'G' is at index 1, word 'is' starts at 0. Offset is 1, but length is 2, so it should snap to front.
      const input = ` G\nis`;
      const expected = `{start_of_verse}\n[G]is\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("preserves trailing chords that fall after the last word", () => {
      const input = `G    C\nHey`;
      const expected = `{start_of_verse}\n[G]Hey [C]\n{end_of_verse}`;
      expect(convertToChordPro(input)).toBe(expected);
    });

    it("applies Czech chord notation conversion when requested", () => {
      const input = `B\nLyric`;
      const expected = `{start_of_verse}\n[H]Lyric\n{end_of_verse}`;
      // Pass 'true' to trigger convertToCzechNotation
      expect(convertToChordPro(input, true)).toBe(expected);
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