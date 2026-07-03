import { describe, it, expect } from "vitest";
import {
  extractPreamble,
  normalizeWhitespace,
  parseChordPro,
  removePreamble,
  replaceRepetitions,
} from "./chordpro";

describe("extractPreamble", () => {
  it("extracts known directives", () => {
    const content = "{title: My Song}\n{artist: Someone}\n{key: C}\n\n[C]lyrics";
    expect(extractPreamble(content)).toEqual({
      title: "My Song",
      artist: "Someone",
      key: "C",
    });
  });

  it("ignores unknown directives and missing ones", () => {
    const content = "{comment: hello}\n[C]lyrics";
    expect(extractPreamble(content)).toEqual({});
  });

  it("is case-insensitive on the directive keyword", () => {
    expect(extractPreamble("{TITLE: My Song}")).toEqual({ title: "My Song" });
  });
});

describe("removePreamble", () => {
  it("strips preamble directive lines and trims the rest", () => {
    const content = "{title: My Song}\n{artist: Someone}\n\n[C]lyrics here";
    expect(removePreamble(content)).toBe("[C]lyrics here");
  });

  it("leaves non-preamble directives untouched", () => {
    const content = "{title: My Song}\n{comment: intro}\n[C]lyrics";
    expect(removePreamble(content)).toBe("{comment: intro}\n[C]lyrics");
  });
});

describe("replaceRepetitions", () => {
  it("converts [: :] bar repeats to repetition symbols", () => {
    expect(replaceRepetitions("[: la la :]")).toBe("𝄆 la la 𝄇");
  });

  it("converts |: :| and ||: :|| repeats", () => {
    expect(replaceRepetitions("|: la :|")).toBe("𝄆 la 𝄇");
    expect(replaceRepetitions("||: la :||")).toBe("𝄆 la 𝄇");
  });

  it("does not cross section boundaries", () => {
    const content =
      "{start_of_verse}[: la :]{end_of_verse}{start_of_chorus}[: da :]{end_of_chorus}";
    expect(replaceRepetitions(content)).toBe(
      "{start_of_verse}𝄆 la 𝄇{end_of_verse}{start_of_chorus}𝄆 da 𝄇{end_of_chorus}",
    );
  });
});

describe("normalizeWhitespace", () => {
  it("trims the whole content", () => {
    expect(normalizeWhitespace("\n\n  hello  \n\n")).toBe("hello");
  });

  it("inserts a blank line before a start_of directive", () => {
    expect(normalizeWhitespace("intro\n{start_of_verse}\nline")).toBe(
      "intro\n\n{start_of_verse}\nline",
    );
  });

  it("does not add a blank line before the very first line", () => {
    expect(normalizeWhitespace("{start_of_verse}\nline")).toBe(
      "{start_of_verse}\nline",
    );
  });

  it("drops an empty line immediately after entering a section", () => {
    const content = "{start_of_verse}\n\nline1\nline2\n{end_of_verse}";
    expect(normalizeWhitespace(content)).toBe(
      "{start_of_verse}\nline1\nline2\n{end_of_verse}",
    );
  });

  it("preserves empty lines within a section body", () => {
    const content = "{start_of_verse}\nline1\n\nline2\n{end_of_verse}";
    expect(normalizeWhitespace(content)).toBe(
      "{start_of_verse}\nline1\n\nline2\n{end_of_verse}",
    );
  });
});

describe("parseChordPro", () => {
  it("combines preamble extraction, stripping, repeats, and whitespace normalization", () => {
    const content =
      "{title: My Song}\n{key: C}\n\n[: [C]la la :]\n{start_of_chorus}\n[C]da\n{end_of_chorus}";
    const result = parseChordPro(content);
    expect(result.title).toBe("My Song");
    expect(result.key).toBe("C");
    expect(result.chordpro).toBe(
      "𝄆 [C]la la 𝄇\n\n{start_of_chorus}\n[C]da\n{end_of_chorus}",
    );
  });
});
