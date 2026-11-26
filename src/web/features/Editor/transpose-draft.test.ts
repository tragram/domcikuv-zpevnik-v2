import { describe, expect, it } from "vitest";
import type { EditorState } from "~/types/types";
import { transposeDraft } from "./transpose-draft";

describe("transposeDraft", () => {
  const song: EditorState = { artist: "Artist", title: "Song", chordpro: "[B]one [H/G]two [spoken]" };

  it("transposes Czech chords and slash bass notes without changing lyrics or the source draft", () => {
    const shifted = transposeDraft(Object.freeze(song), 1);
    expect(shifted.chordpro).toBe("[H]one [C/Ab]two [spoken]");
    expect(transposeDraft(shifted, -1)).toEqual(song);
  });

  it("reads directive-controlled values from the transposed text exactly once", () => {
    const chordpro = "{key: C}\n{capo: 0}\n{range: c1-g1}\n{startmelody: c1, G2}\n[C]one";
    const shifted = transposeDraft({ ...song, chordpro, key: "F", capo: 5, range: "f1-a1", startMelody: "f" }, 1);
    expect(shifted).toMatchObject({
      chordpro: "{key: C#}\n{capo: 11}\n{range: c#1-g#1}\n{startmelody: c#1, G#2}\n[C#]one",
      key: "C#", capo: 11, range: "c#1-g#1", startMelody: "c#1, G#2",
    });
  });

  it("shifts manual metadata without inserting directives and wraps the capo downwards", () => {
    const shifted = transposeDraft({ ...song, key: "Dm", capo: "11", range: "d1-a1", startMelody: "D2, a1 rest" }, -1);
    expect(shifted).toMatchObject({ capo: 0, range: "c#1-g#1", startMelody: "C#2, g#1 rest" });
    expect(shifted.key).toMatch(/^C#m(i)?$/);
    expect(shifted.chordpro).not.toContain("{");
  });
});
