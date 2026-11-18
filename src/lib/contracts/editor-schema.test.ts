import { expect, it } from "vitest";
import { editorContentPatchSchema } from "./editor-schema";

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
