// @vitest-environment happy-dom
import { ChordProParser, HtmlDivFormatter } from "chordsheetjs";
import { describe, expect, it } from "vitest";
import { formatChordpro } from "~/lib/formatChordpro";
import { convertHTMLChordNotation } from "./chordNotation";
import { compareChordLists, postProcessChordPro } from "./postProcessing";
import { czechToEnglish, preparseDirectives } from "./preparseChordpro";

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
  const processed = postProcessChordPro(convertHTMLChordNotation(html, false));
  return new DOMParser().parseFromString(processed, "text/html");
}

it.each([
  { name: "R1", sideways: false },
  { name: "R12", sideways: true },
  { name: "Sóló", sideways: true },
])("lays out $name vertically at its definition and horizontally in both recall views", ({ name, sideways }) => {
  const doc = renderDocument(`
{start_of_chorus: ${name}}
[C]First line
[G]Second line
{end_of_chorus}

{start_of_verse}
Another verse
{end_of_verse}

{chorus: ${name}}
  `);

  const definition = doc.querySelector(".chorus:has(> .section-marker--stacked)");
  const definitionMarker = definition?.querySelector(".section-marker");
  expect(definitionMarker?.textContent).toBe(name);
  expect(definitionMarker?.classList.contains("section-marker--sideways")).toBe(sideways);
  expect(definition?.querySelectorAll(".section-definition-content > .row")).toHaveLength(2);
  for (const view of ["expanded", "shorthand"]) {
    const marker = doc.querySelector(`.${view}-section .section-marker--horizontal`);
    expect(marker?.textContent).toBe(name);
    expect(marker?.closest(".row")).not.toBeNull();
  }
});

it.each(["R", "1", "Outro"])("uses an inline %s pill for a single song line even with a comment", (name) => {
  const doc = renderDocument(`
{start_of_chorus: ${name}}
{comment: Sing softly}
[C]Only one line
{end_of_chorus}
  `);

  const marker = doc.querySelector(".chorus .section-marker--horizontal");
  expect(marker?.textContent).toBe(name);
  expect(marker?.classList.contains("section-marker--one-character")).toBe(name.length === 1);
  const cells = marker?.closest(".row")?.querySelectorAll(".lyrics") ?? [];
  expect(Array.from(cells, (cell) => cell.textContent).join("")).toBe("Only one line");
  expect(doc.querySelector(".section-definition-content")).toBeNull();
});

it("uses a circular badge for a collapsed chorus containing only its marker", () => {
  const doc = renderDocument(`
{start_of_chorus}
[C]First line
[G]Second line
{end_of_chorus}

{start_of_verse}
Another verse
{end_of_verse}

{chorus}
  `);

  const badges = doc.querySelectorAll(".section-marker--horizontal.section-marker--one-character");
  expect(badges).toHaveLength(1);
  expect(badges[0].closest(".shorthand-section")).not.toBeNull();
});

it.each(["", "R1"])("shows the total count ahead of a chorus and beside its collapsed recall (%s)", (name) => {
  const chorus = name ? `{chorus: ${name}}` : "{chorus}";
  const doc = renderDocument(`
${name ? `{start_of_chorus: ${name}}` : "{start_of_chorus}"}
[C]First line
[G]Second line
{end_of_chorus}
${chorus}
${chorus}

{start_of_verse}
Another verse
{end_of_verse}

${chorus}
${chorus}
  `);

  const definition = doc.querySelector(".chorus:not(.expanded-section, .shorthand-section)");
  const expanded = doc.querySelector(".expanded-section");
  for (const [section, count] of [[definition, "×3"], [expanded, "×2"]] as const) {
    const heading = section?.querySelector(".section-repeat-heading");
    expect(heading?.querySelector(".repetition-count")?.textContent).toBe(count);
    const lyrics = heading?.nextElementSibling?.querySelectorAll(".lyrics") ?? [];
    expect(Array.from(lyrics, (cell) => cell.textContent).join("")).toBe("First line");
    expect(section?.querySelectorAll(".row:has(.lyrics)")).toHaveLength(2);
  }

  const collapsed = doc.querySelector(".shorthand-section");
  expect(collapsed?.querySelector(".section-marker + .repetition-count")?.parentElement?.textContent).toBe(`${name || "R"}×2`);
  expect(collapsed?.querySelector(".lyrics")).toBeNull();
});

it("shows a count even when the repeated section has no label", () => {
  const doc = renderDocument(`
{start_of_verse}
Only line
{end_of_verse}
{verse}
  `);

  const heading = doc.querySelector(".verse .section-repeat-heading");
  expect(heading?.querySelector(".repetition-count")?.textContent).toBe("×2");
  expect(heading?.nextElementSibling?.querySelector(".lyrics")?.textContent).toBe("Only line");
});

it("styles the count before the opening sign of a multiline lyric repeat", () => {
  const source = `
{start_of_verse}
𝄆 [D]Vysyp ten [A]popel, kamará[Em]de,
do bílé [G]vody, vo[D]dy / Heja hej...
Vyhasnul [A]kotel a náhoda
[Emi]je štěstí od podko[G]vy. [G/F#][G] 𝄇 (3x)
{end_of_verse}
  `;
  const doc = renderDocument(czechToEnglish(formatChordpro(source)));

  const rows = doc.querySelectorAll(".verse > .row");
  expect(rows).toHaveLength(4);
  const opening = rows[0].querySelector(".lyrics > .repetition-count + .repetition");
  expect(opening?.previousElementSibling?.textContent).toBe("×3");
  expect(opening?.textContent).toBe("𝄆");
  expect(rows[3].querySelector(".lyrics > .repetition")?.parentElement?.textContent).toBe("𝄇");
  const chords = Array.from(rows[3].querySelectorAll(".chord"), (chord) => chord.textContent);
  expect(chords.filter(Boolean)).toEqual(["Em", "G", "G/F♯", "G"]);
});

it.each(["3x 𝄆", "(3x) 𝄆", "3x |:"])("recognizes a leading count with %s in Na Hotelu v Olomouci", (start) => {
  const end = start.endsWith("𝄆") ? "𝄇" : ":|";
  const source = `
{start_of_chorus}
${start} [Em]Na, [Hm]na, na…[D][A] ${end}
[Em]Na, na, [G]na… [D][A]
{end_of_chorus}
  `;
  const doc = renderDocument(czechToEnglish(formatChordpro(source)));

  const [repeated, following] = doc.querySelectorAll(".chorus > .row");
  const opening = repeated.querySelector(".repetition-count + .repetition");
  expect(opening?.parentElement?.textContent?.trim()).toBe("×3𝄆");
  expect(repeated.querySelectorAll(".repetition")[1]?.textContent).toBe("𝄇");
  const followingLyrics = Array.from(following.querySelectorAll(".lyrics"), (cell) => cell.textContent);
  expect(followingLyrics.join("").trim()).toBe("Na, na, na…");
  expect(following.querySelector(".repetition, .repetition-count")).toBeNull();
});

it.each(["x3", "3x", "(x3)", "×3"])("moves the trailing count %s to the opening repeat sign", (count) => {
  const doc = renderDocument(`𝄆 [C]Sing 𝄇 ${count} then stop`);

  expect(doc.querySelector(".repetition-count + .repetition")?.previousElementSibling?.textContent).toBe("×3");
  expect(doc.body.textContent).toContain("𝄇 then stop");
});

it("keeps lyrics that start with a count-like word after a closing sign", () => {
  const doc = renderDocument("𝄆 Sing 𝄇 x3rd 𝄆 play 𝄇 3xylophones");

  expect(doc.querySelector(".repetition-count")).toBeNull();
  expect(doc.body.textContent).toContain("𝄇 x3rd");
  expect(doc.body.textContent).toContain("𝄇 3xylophones");
});

it("keeps explicit repeat counts scoped to their paired signs", () => {
  const doc = renderDocument(`
{start_of_verse}
Before 𝄆 one 𝄇 (3x) between 𝄆 two 𝄇 (4×) after
𝄆 No explicit count here 𝄇
Unclosed 6x 𝄆
{end_of_verse}
{start_of_verse}
Unmatched 𝄇 (5x)
{end_of_verse}
  `);

  const openings = doc.querySelectorAll(".repetition-count + .repetition");
  expect(Array.from(openings, (sign) => sign.previousElementSibling?.textContent)).toEqual(["×3", "×4"]);
  expect(doc.body.textContent).toContain("𝄇 after");
  expect(doc.body.textContent).toContain("Unclosed 6x 𝄆");
  expect(doc.body.textContent).toContain("Unmatched 𝄇 (5x)");
});

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
