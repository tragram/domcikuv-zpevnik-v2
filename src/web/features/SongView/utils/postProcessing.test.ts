// @vitest-environment happy-dom
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import { describe, expect, it } from "vitest";
import { compareChordLists, postProcessChordPro } from "./postProcessing";
import { preparseDirectives } from "./preparseChordpro";

/**
 * Runs the render pipeline (preparse -> ChordSheetJS -> postprocess) and
 * summarises each rendered paragraph for assertions.
 */
function renderSections(chordpro: string) {
  const song = new ChordProParser().parse(preparseDirectives(chordpro.trim()));
  const html = new HtmlDivFormatter().format(song);
  const processed = postProcessChordPro(html);
  const doc = new DOMParser().parseFromString(processed, "text/html");
  return Array.from(doc.querySelectorAll(".paragraph")).map((p) => ({
    classes: Array.from(p.classList),
    chords: Array.from(p.querySelectorAll(".chord"))
      .map((c) => c.textContent?.trim() ?? "")
      .filter(Boolean),
    hidden: p.classList.contains("repeated-chords"),
    forceShown: Array.from(p.querySelectorAll(".chord.force-shown")).map(
      (c) => c.textContent?.trim() ?? "",
    ),
  }));
}

describe("detectRepeatedChordPatterns (via postProcessChordPro)", () => {
  it("hides chords of a verse identical to a previous one", () => {
    // Regression: lyrics are rendered as <div class="lyrics">; a stray
    // "span.lyrics" selector once made every section look instrumental and
    // disabled the whole feature.
    const sections = renderSections(`
{start_of_verse}
[A]First line [D]here
[E]Second line [A]too
{end_of_verse}

{start_of_verse}
[A]Third line [D]here
[E]Fourth line [A]too
{end_of_verse}
    `);

    expect(sections).toHaveLength(2);
    expect(sections[0].hidden).toBe(false);
    expect(sections[1].hidden).toBe(true);
    expect(sections[1].forceShown).toEqual([]);
  });

  it("keeps chords visible on instrumental (chords-only) sections", () => {
    const sections = renderSections(`
{start_of_verse}
[A][D][E]
{end_of_verse}

{start_of_verse}
[A][D][E]
{end_of_verse}
    `);

    expect(sections).toHaveLength(2);
    expect(sections.every((s) => !s.hidden)).toBe(true);
  });

  it("force-shows only the changed chord in a near-repeat", () => {
    const sections = renderSections(`
{start_of_verse}
[A]First line [D]here
[E]Second line [A]too
{end_of_verse}

{start_of_verse}
[A]Third line [C]here
[E]Fourth line [A]too
{end_of_verse}
    `);

    expect(sections[1].hidden).toBe(true);
    expect(sections[1].forceShown).toEqual(["C"]);
  });

  it("aligns past an inserted chord instead of shift-mismatching the rest", () => {
    const sections = renderSections(`
{start_of_verse}
[A]First [D]line
[E]Second [A]line
{end_of_verse}

{start_of_verse}
[G]Extra [A]first [D]line
[E]Second [A]line
{end_of_verse}
    `);

    expect(sections[1].hidden).toBe(true);
    expect(sections[1].forceShown).toEqual(["G"]);
  });

  it("aligns past a removed chord", () => {
    const sections = renderSections(`
{start_of_verse}
[A]First [D]line
[E]Second [A]line
{end_of_verse}

{start_of_verse}
[A]First line
[E]Second [A]line
{end_of_verse}
    `);

    expect(sections[1].hidden).toBe(true);
    expect(sections[1].forceShown).toEqual([]);
  });

  it("does not treat a short section with entirely different chords as a repeat", () => {
    // With a flat distance cap, [C G] would count as a "repeat" of [A D]
    const sections = renderSections(`
{start_of_verse}
[A]First [D]line
{end_of_verse}

{start_of_verse}
[C]Other [G]line
{end_of_verse}
    `);

    expect(sections[1].hidden).toBe(false);
    expect(sections[1].forceShown).toEqual([]);
  });

  it("keeps sections with several blank lines as one paragraph and matches them", () => {
    const song = (suffix: string) => `
{start_of_verse}
[A]part one ${suffix}

[D]part two ${suffix}

[E]part three ${suffix}
{end_of_verse}
    `;
    const sections = renderSections(song("a") + "\n" + song("b"));

    // Previously only the first blank line survived preparsing, so
    // ChordSheetJS split each verse into several paragraph fragments
    expect(sections).toHaveLength(2);
    expect(sections[0].chords).toEqual(["A", "D", "E"]);
    expect(sections[0].hidden).toBe(false);
    expect(sections[1].hidden).toBe(true);
  });

  it("matches labeled and unlabeled sections in either order", () => {
    const labeledFirst = renderSections(`
{start_of_verse: V1}
[A]First [D]line [E]here
{end_of_verse}

{start_of_verse}
[A]Second [D]line [E]here
{end_of_verse}
    `);
    expect(labeledFirst[1].hidden).toBe(true);

    const unlabeledFirst = renderSections(`
{start_of_verse}
[A]First [D]line [E]here
{end_of_verse}

{start_of_verse: V1}
[A]Second [D]line [E]here
{end_of_verse}
    `);
    expect(unlabeledFirst[1].hidden).toBe(true);
  });

  it("hides chords in the expanded copy of a chorus recall", () => {
    const sections = renderSections(`
{start_of_chorus}
[A]Chorus line [D]la
[E]Second line [A]la
{end_of_chorus}

{start_of_verse}
[C]Verse line [G]here
{end_of_verse}

{chorus}
    `);

    const expanded = sections.find((s) =>
      s.classes.includes("expanded-section"),
    );
    expect(expanded).toBeDefined();
    expect(expanded?.hidden).toBe(true);
  });

  it("does not match sections across different section types", () => {
    const sections = renderSections(`
{start_of_chorus}
[A]Chorus line [D]la
[E]Third line [A]la
{end_of_chorus}

{start_of_verse}
[A]Verse line [D]la
[E]Fourth line [A]la
{end_of_verse}
    `);

    expect(sections[1].hidden).toBe(false);
  });

  it("matches a verse against any earlier verse, not just the previous one", () => {
    const sections = renderSections(`
{start_of_verse}
[A]one [D]two
[E]three [A]four
{end_of_verse}

{start_of_verse}
[C]other [G]chords
[C]entirely [G]different
{end_of_verse}

{start_of_verse}
[A]five [D]six
[E]seven [A]eight
{end_of_verse}
    `);

    expect(sections[1].hidden).toBe(false);
    expect(sections[2].hidden).toBe(true);
    expect(sections[2].forceShown).toEqual([]);
  });
});

describe("compareChordLists", () => {
  it("reports identical lists as an exact match", () => {
    expect(compareChordLists(["A", "D", "E"], ["A", "D", "E"])).toEqual({
      matches: [true, true, true],
      distance: 0,
    });
  });

  it("counts a substitution and flags only the substituted chord", () => {
    expect(compareChordLists(["A", "D", "E"], ["A", "C", "E"])).toEqual({
      matches: [true, false, true],
      distance: 1,
    });
  });

  it("aligns around an insertion into the current chords", () => {
    expect(
      compareChordLists(["A", "D", "E", "A"], ["G", "A", "D", "E", "A"]),
    ).toEqual({
      matches: [false, true, true, true, true],
      distance: 1,
    });
  });

  it("aligns around a deletion from the pattern", () => {
    expect(compareChordLists(["A", "D", "E", "A"], ["A", "E", "A"])).toEqual({
      matches: [true, true, true],
      distance: 1,
    });
  });

  it("handles empty inputs", () => {
    expect(compareChordLists([], [])).toEqual({ matches: [], distance: 0 });
    expect(compareChordLists([], ["A", "D"])).toEqual({
      matches: [false, false],
      distance: 2,
    });
    expect(compareChordLists(["A", "D"], [])).toEqual({
      matches: [],
      distance: 2,
    });
  });
});
