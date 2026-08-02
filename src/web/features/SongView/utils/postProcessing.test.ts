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
  const doc = renderDocument(chordpro);
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

function renderDocument(chordpro: string) {
  const song = new ChordProParser().parse(preparseDirectives(chordpro.trim()));
  const html = new HtmlDivFormatter().format(song);
  const processed = postProcessChordPro(html);
  return new DOMParser().parseFromString(processed, "text/html");
}

describe("detectRepeatedChordPatterns (via postProcessChordPro)", () => {
  it("adds spacing only to comments outside sections", () => {
    const parse = (chordpro: string) => {
      const song = new ChordProParser().parse(preparseDirectives(chordpro));
      const html = postProcessChordPro(new HtmlDivFormatter().format(song));
      return new DOMParser().parseFromString(html, "text/html");
    };

    const standalone = parse(`
{comment: Intro}
{start_of_verse}
[C]First line
{end_of_verse}
    `.trim());
    expect(
      standalone
        .querySelector(".comment")
        ?.closest(".row")
        ?.classList.contains("standalone-comment"),
    ).toBe(true);

    const withinSection = parse(`
{start_of_verse}
[C]First line
{comment: Sing softly}
[G]Second line
{end_of_verse}
    `.trim());
    expect(
      withinSection
        .querySelector(".comment")
        ?.closest(".row")
        ?.classList.contains("standalone-comment"),
    ).toBe(false);
  });

  it("keeps tabs inside their enclosing section", () => {
    const song = new ChordProParser().parse(
      preparseDirectives(`
{start_of_verse}
[Am]Before
{start_of_tab}
e|--0--    3x--|
B|--1--|
{end_of_tab}
[E]After
{end_of_verse}
      `.trim()),
    );
    const html = postProcessChordPro(new HtmlDivFormatter().format(song));
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(song.warnings).toEqual([]);
    expect(doc.querySelectorAll(".verse")).toHaveLength(1);
    const tab = doc.querySelector(".verse > .paragraph.tab .literal");
    expect(tab?.textContent).toBe("e|--0--    3x--|B|--1--|");
    expect(tab?.querySelectorAll("br")).toHaveLength(1);
  });

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

  it("only hides an interlude when its chord progression is an exact match", () => {
    const sections = renderSections(`
{start_of_interlude}
[A]one [D]two [E]three
{end_of_interlude}

{start_of_interlude}
[A]one [D]two [C]three
{end_of_interlude}

{start_of_interlude}
[A]one [D]two [E]three
{end_of_interlude}
    `);

    expect(sections[1].hidden).toBe(false);
    expect(sections[2].hidden).toBe(true);
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

  it("hides a chord pattern repeated within one section", () => {
    const doc = renderDocument(`
{start_of_chorus}
[A]one [D]two [E]three [A]four

[A]five [D]six [E]seven [A]eight

[A]nine [D]ten [E]eleven [A]twelve
{end_of_chorus}
    `);

    const chordRows = Array.from(doc.querySelectorAll(".chorus .row")).filter(
      (row) => row.querySelector(".chord"),
    );
    expect(chordRows).toHaveLength(3);
    expect(
      chordRows.map((row) => row.classList.contains("repeated-chords")),
    ).toEqual([false, true, true]);
  });

  it("force-shows a changed chord in a repeated subsection", () => {
    const doc = renderDocument(`
{start_of_chorus}
[A]one [D]two [E]three [A]four

[A]five [C]six [E]seven [A]eight

[A]nine [D]ten [E]eleven [A]twelve
{end_of_chorus}
    `);

    const chordRows = Array.from(doc.querySelectorAll(".chorus .row")).filter(
      (row) => row.querySelector(".chord"),
    );
    expect(
      chordRows.map((row) => row.classList.contains("repeated-chords")),
    ).toEqual([false, true, true]);
    expect(
      Array.from(chordRows[1].querySelectorAll(".chord.force-shown")).map(
        (chord) => chord.textContent?.trim(),
      ),
    ).toEqual(["C"]);
  });

  it("treats multiple lyric rows between blank lines as one subsection", () => {
    const doc = renderDocument(`
{start_of_chorus}
[A]first line [D]here
[E]second line [A]here

[A]third line [D]here
[E]fourth line [A]here
{end_of_chorus}
    `);

    const chordRows = Array.from(doc.querySelectorAll(".chorus .row")).filter(
      (row) => row.querySelector(".chord"),
    );
    expect(chordRows).toHaveLength(4);
    expect(
      chordRows.map((row) => row.classList.contains("repeated-chords")),
    ).toEqual([false, false, true, true]);
  });

  it("ignores empty subsections created by consecutive blank lines", () => {
    const doc = renderDocument(`
{start_of_chorus}
[A]one [D]two [E]three



[A]four [D]five [E]six
{end_of_chorus}
    `);

    const chordRows = Array.from(doc.querySelectorAll(".chorus .row")).filter(
      (row) => row.querySelector(".chord"),
    );
    expect(chordRows).toHaveLength(2);
    expect(chordRows[0].classList.contains("repeated-chords")).toBe(false);
    expect(chordRows[1].classList.contains("repeated-chords")).toBe(true);
  });

  it("keeps a repeated chord-only subsection visible", () => {
    const doc = renderDocument(`
{start_of_chorus}
[A][D][E]

[A][D][E]
{end_of_chorus}
    `);

    const chordRows = Array.from(doc.querySelectorAll(".chorus .row")).filter(
      (row) => row.querySelector(".chord"),
    );
    expect(chordRows).toHaveLength(2);
    expect(
      chordRows.every((row) => !row.classList.contains("repeated-chords")),
    ).toBe(true);
  });

  it("prioritizes a complete section match over subsection changes", () => {
    const chorus = (suffix: string) => `
{start_of_chorus}
[A]one ${suffix} [D]two [E]three [A]four

[A]five ${suffix} [C]six [E]seven [A]eight

[A]nine ${suffix} [D]ten [E]eleven [A]twelve
{end_of_chorus}
    `;
    const sections = renderSections(chorus("first") + chorus("second"));

    expect(sections).toHaveLength(2);
    expect(sections[1].hidden).toBe(true);
    expect(sections[1].forceShown).toEqual([]);
  });

  it("uses whole-section alignment for a near-repeat before checking subsections", () => {
    const sections = renderSections(`
{start_of_chorus}
[A]one [D]two [E]three [A]four

[A]five [C]six [E]seven [A]eight
{end_of_chorus}

{start_of_chorus}
[A]nine [D]ten [E]eleven [A]twelve

[A]thirteen [G]fourteen [E]fifteen [A]sixteen
{end_of_chorus}
    `);

    expect(sections).toHaveLength(2);
    expect(sections[1].hidden).toBe(true);
    expect(sections[1].forceShown).toEqual(["G"]);
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
