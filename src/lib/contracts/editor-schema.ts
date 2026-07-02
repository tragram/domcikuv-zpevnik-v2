// Shared client/server contract: the editor submission schema. The worker
// validates requests with it; the client uses it for pre-submit form validation.
import { z } from "zod";
import { parseYoutubeId } from "src/lib/youtube";

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

// The PUT (edit existing song) route additionally accepts an admin-only flag.
export const editorUpdateSchema = editorSubmitSchema.extend({
  // When an admin approves another user's pending submission from the editor,
  // keep the original submitter as the version's author (the admin is still
  // recorded as the approver). Ignored for non-admins and non-pending edits.
  editAsSubmitter: z.boolean().optional(),
});

export const autofillChordproSchema = z.object({
  chordpro: z.string(),
});

export type EditorSubmitSchema = z.infer<typeof editorSubmitSchema>;
export type EditorSubmitSchemaInput = z.input<typeof editorSubmitSchema>;
export type EditorUpdateSchemaInput = z.input<typeof editorUpdateSchema>;
