// Shared client/server contract: the editor submission schema. The worker
// validates requests with it; the client uses it for pre-submit form validation.
import { z } from "zod";
import { parseYoutubeId } from "src/lib/youtube";

const shortText = (limit: number) =>
  z
    .string()
    .nullable()
    .optional()
    .transform((value) =>
      value == null
        ? value
        : value.normalize("NFC").trim().replace(/\s+/gu, " ") || null,
    )
    .refine(
      (value) => value == null || [...value].length <= limit,
      `Maximum ${limit} characters`,
    )
    .optional();

export const editorSubmitSchema = z.object({
  title: z.string().min(1, "Title is required"),
  artist: z.string().min(1, "Artist is required"),
  language: z
    .string()
    .min(1, "Language is required")
    .optional()
    .transform((x) => x || null),
  chordpro: z.string().min(1, "ChordPro content is required"),
  parentId: z.string().optional(),
  baseVersionId: z.string().optional(),
  expectedRevision: z.number().int().positive().optional(),
  saveMode: z.enum(["correction", "new-version"]).optional(),
  label: shortText(20),
  description: shortText(120),
  archivePreviousOnPublish: z.boolean().optional(),
  makeOfficialOnPublish: z.boolean().optional(),

  key: z
    .string()
    .regex(/^[A-H][#b]?(m|mi)?$/, "Invalid key format (e.g., C, C#, Dm, Ami)")
    .optional()
    .or(z.literal("")) // Catch empty strings when user clears the input
    .transform((x) => x || null),

  capo: z
    .union([z.string(), z.number()])
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      // 1. Let empty states pass through to the transform block
      if (val === "" || val == null) return true;

      // 2. Ensure the value only contains numbers (and optionally a leading minus sign)
      return /^-?\d+$/.test(String(val).trim());
    }, "Capo must be a valid whole number")
    .transform((x) => (x === "" || x == null ? null : Number(x))),

  range: z
    .string()
    .regex(/^[a-h][#b]?\d+-[a-h][#b]?\d+$/, "Range must be in format: c1-g2")
    .optional()
    .or(z.literal(""))
    .transform((x) => x || null),

  startMelody: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((x) => x || null),

  tempo: z
    .union([z.string(), z.number()])
    .optional()
    .or(z.literal(""))
    .transform((x) => (x ? String(x) : null)),

  // Accepts a pasted YouTube URL or a bare video id; stored as the canonical
  // 11-char id. Empty clears it; anything non-empty that isn't a YouTube link
  // is a validation error.
  youtubeId: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((x, ctx) => {
      if (!x || !x.trim()) return null;
      const id = parseYoutubeId(x);
      if (!id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid YouTube URL or video id",
        });
        return z.NEVER;
      }
      return id;
    }),
});

export const editorUpdateSchema = editorSubmitSchema.extend({
  publish: z.boolean().optional(),
  // Admins can choose attribution to the author of the version being edited.
  editAsPreviousAuthor: z.boolean().optional(),
  // Older clients only chose attribution for pending submissions.
  editAsSubmitter: z.boolean().optional(),
  addToFavorites: z.boolean().optional(),
});

// Put undefined first: wrapping a transforming field in .partial() can turn an
// omitted field into null and inadvertently clear unrelated sheet metadata.
const patchField = <T extends z.ZodType>(field: T) =>
  z.union([z.undefined(), field]).optional();
export const editorContentPatchSchema = z.object({
  title: patchField(editorSubmitSchema.shape.title),
  artist: patchField(editorSubmitSchema.shape.artist),
  chordpro: patchField(editorSubmitSchema.shape.chordpro),
  label: patchField(editorSubmitSchema.shape.label),
  description: patchField(editorSubmitSchema.shape.description),
  key: patchField(editorSubmitSchema.shape.key.nullable()),
  language: patchField(editorSubmitSchema.shape.language.nullable()),
  capo: patchField(editorSubmitSchema.shape.capo.nullable()),
  range: patchField(editorSubmitSchema.shape.range.nullable()),
  startMelody: patchField(editorSubmitSchema.shape.startMelody.nullable()),
  tempo: patchField(editorSubmitSchema.shape.tempo.nullable()),
  youtubeId: patchField(editorSubmitSchema.shape.youtubeId.nullable()),
});

export const autofillChordproSchema = z.object({
  chordpro: z.string(),
});

export type EditorSubmitSchema = z.infer<typeof editorSubmitSchema>;
export type EditorSubmitSchemaInput = z.input<typeof editorSubmitSchema>;
export type EditorUpdateSchemaInput = z.input<typeof editorUpdateSchema>;
