import { expect, it } from "vitest";
import { editorContentPatchSchema, editorSubmitSchema } from "./editor-schema";

it("preserves omitted fields when patching one metadata field", () => {
  expect(editorContentPatchSchema.parse({ youtubeId: "dQw4w9WgXcQ" }))
    .toEqual({ youtubeId: "dQw4w9WgXcQ" });
  expect(editorContentPatchSchema.parse({})).toEqual({});
});

it("permits explicit clears while preserving required content validation", () => {
  expect(editorContentPatchSchema.parse({ label: "", key: null, capo: "" }))
    .toEqual({ label: null, key: null, capo: null });
  expect(editorContentPatchSchema.safeParse({ title: null }).success).toBe(false);
  expect(editorContentPatchSchema.safeParse({ chordpro: "" }).success).toBe(false);
});

it("normalizes version details and counts Unicode code points", () => {
  const content = { title: "Song", artist: "Artist", chordpro: "Words" };
  expect(editorSubmitSchema.parse({ ...content, label: "  A   version ", description: " " }))
    .toMatchObject({ label: "A version", description: null });
  expect(editorSubmitSchema.safeParse({ ...content, label: "🎵".repeat(20) }).success).toBe(true);
  expect(editorSubmitSchema.safeParse({ ...content, label: "🎵".repeat(21) }).success).toBe(false);
  expect(editorSubmitSchema.parse(content).label).toBeUndefined();
});
