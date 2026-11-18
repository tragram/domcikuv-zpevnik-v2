import { describe, expect, it } from "vitest";
import { analyzeSongEdit } from "./song-edit-analysis";
import {
  editorSubmitSchema,
} from "./contracts/editor-schema";

describe("edit recommendations", () => {
  it("strongly favors corrections for a typo or harmless reflow", () => {
    expect(analyzeSongEdit("[C]Hello world", "[C]Hello there").large).toBe(
      false,
    );
    expect(
      analyzeSongEdit("Hello world again", "Hello\nworld again").large,
    ).toBe(false);
  });
  it("recommends replacements for substantial or structural edits", () => {
    expect(
      analyzeSongEdit(
        "Hello world",
        "One two three four five six seven eight nine",
      ).large,
    ).toBe(true);
    expect(analyzeSongEdit("{chorus}\nHello", "{verse}\nHello").large).toBe(
      true,
    );
  });
  it("normalizes metadata, supports explicit clears, and counts Unicode code points", () => {
    const content = { title: "Song", artist: "Artist", chordpro: "Words" };
    expect(
      editorSubmitSchema.parse({
        ...content,
        label: "  A   version ",
        description: " ",
      }),
    ).toMatchObject({ label: "A version", description: null });
    expect(
      editorSubmitSchema.safeParse({ ...content, label: "🎵".repeat(20) })
        .success,
    ).toBe(true);
    expect(
      editorSubmitSchema.safeParse({ ...content, label: "🎵".repeat(21) })
        .success,
    ).toBe(false);
    expect(editorSubmitSchema.parse(content).label).toBeUndefined();
  });
});
