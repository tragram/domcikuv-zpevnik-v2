import { describe, it, expect } from "vitest";
import {
  applyVariant,
  EXPANDED_SECTION_DIRECTIVE,
  SHORTHAND_SECTION_DIRECTIVE,
} from "./variantHandlers";

// A typical parsed section: start directive, three lyric lines, end directive.
const section = () => [
  "{start_of_verse}",
  "line1",
  "line2",
  "line3",
  "{end_of_verse}",
];

const TITLE = "{comment: %section_title: Verse%}";

describe("applyVariant", () => {
  describe("replace_last_line", () => {
    it("repeat: keeps all but the last lyric line, appends the new content", () => {
      const result = applyVariant(section(), "replace_last_line", ["NEW"], true, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "line1",
        "line2",
        "NEW",
        "{end_of_verse}",
      ]);
    });

    it("shorthand: collapses to a single ellipsis line", () => {
      const result = applyVariant(section(), "replace_last_line", ["NEW"], false, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        SHORTHAND_SECTION_DIRECTIVE,
        TITLE,
        "...NEW",
        "{end_of_verse}",
      ]);
    });

    it("skips a pre-existing section-title comment when finding the lyric start", () => {
      const lines = [
        "{start_of_verse}",
        "{comment: %section_title: Verse%}",
        "l1",
        "l2",
        "l3",
        "{end_of_verse}",
      ];
      const result = applyVariant(lines, "replace_last_line", ["NEW"], true, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "l1",
        "l2",
        "NEW",
        "{end_of_verse}",
      ]);
    });
  });

  describe("replace_last_n_lines", () => {
    it("repeat: replaces the last n lines (n from args)", () => {
      const result = applyVariant(
        section(),
        "replace_last_n_lines",
        ["NEW"],
        true,
        TITLE,
        ["2"],
      );
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "line1",
        "NEW",
        "{end_of_verse}",
      ]);
    });

    it("defaults n to 1 when no args are given", () => {
      const result = applyVariant(section(), "replace_last_n_lines", ["NEW"], true, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "line1",
        "line2",
        "NEW",
        "{end_of_verse}",
      ]);
    });

    it("clamps n to the number of available lyric lines", () => {
      const result = applyVariant(
        section(),
        "replace_last_n_lines",
        ["NEW"],
        true,
        TITLE,
        ["99"],
      );
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "NEW",
        "{end_of_verse}",
      ]);
    });

    it("shorthand: collapses to a single ellipsis line regardless of n", () => {
      const result = applyVariant(
        section(),
        "replace_last_n_lines",
        ["NEW"],
        false,
        TITLE,
        ["2"],
      );
      expect(result).toEqual([
        "{start_of_verse}",
        SHORTHAND_SECTION_DIRECTIVE,
        TITLE,
        "...NEW",
        "{end_of_verse}",
      ]);
    });
  });

  describe("append_content", () => {
    it("repeat: keeps all lyric lines and appends the new content", () => {
      const result = applyVariant(section(), "append_content", ["NEW"], true, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "line1",
        "line2",
        "line3",
        "NEW",
        "{end_of_verse}",
      ]);
    });

    it("shorthand: shows a '+ ' prefixed summary line", () => {
      const result = applyVariant(section(), "append_content", ["NEW"], false, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        SHORTHAND_SECTION_DIRECTIVE,
        TITLE,
        "+ NEW",
        "{end_of_verse}",
      ]);
    });
  });

  describe("replace_first_line", () => {
    it("repeat: replaces only the first lyric line", () => {
      const result = applyVariant(section(), "replace_first_line", ["NEW"], true, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "NEW",
        "line2",
        "line3",
        "{end_of_verse}",
      ]);
    });

    it("shorthand: shows the new content trimmed with an ellipsis", () => {
      const result = applyVariant(section(), "replace_first_line", ["  NEW  "], false, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        SHORTHAND_SECTION_DIRECTIVE,
        TITLE,
        "NEW...",
        "{end_of_verse}",
      ]);
    });
  });

  describe("prepend_content", () => {
    it("repeat: inserts the new content before the existing lyric lines", () => {
      const result = applyVariant(section(), "prepend_content", ["NEW"], true, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        EXPANDED_SECTION_DIRECTIVE,
        TITLE,
        "NEW",
        "line1",
        "line2",
        "line3",
        "{end_of_verse}",
      ]);
    });

    it("shorthand: shows the new content with an ellipsis, followed by the full lyrics", () => {
      const result = applyVariant(section(), "prepend_content", ["NEW"], false, TITLE);
      expect(result).toEqual([
        "{start_of_verse}",
        SHORTHAND_SECTION_DIRECTIVE,
        TITLE,
        "NEW...",
        "line1",
        "line2",
        "line3",
        "{end_of_verse}",
      ]);
    });
  });

  describe("fallback behavior", () => {
    it("falls back to a warning comment for an unknown variant type", () => {
      const result = applyVariant(section(), "not_a_real_variant", ["NEW"], true, TITLE);
      expect(result).toEqual([
        ...section(),
        "{comment: Warning: Unprocessed or Invalid Variant (not_a_real_variant)}",
        "NEW",
      ]);
    });

    it("falls back when there are too few original lines to process", () => {
      const shortLines = ["{start_of_verse}", "{end_of_verse}"];
      const result = applyVariant(shortLines, "replace_last_line", ["NEW"], true, TITLE);
      expect(result).toEqual([
        ...shortLines,
        "{comment: Warning: Unprocessed or Invalid Variant (replace_last_line)}",
        "NEW",
      ]);
    });
  });

  describe("multi-line variant content", () => {
    it("joins and trims multi-line content into a single normalized line", () => {
      const result = applyVariant(
        section(),
        "append_content",
        ["line A", "line B"],
        false,
        TITLE,
      );
      expect(result).toEqual([
        "{start_of_verse}",
        SHORTHAND_SECTION_DIRECTIVE,
        TITLE,
        "+ line A\nline B",
        "{end_of_verse}",
      ]);
    });
  });
});
