import { isValidYoutubeId } from "../../src/lib/youtube";
import { z } from "zod";

export const segment = z.string().regex(/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/)
  .refine(value => !value.endsWith(".") && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(value));
const versionName = z.string().regex(/^v[1-9]\d*$/)
  .refine(name => Number.isSafeInteger(Number(name.slice(1))));
const versionId = z.string().min(1);
export const reservedVersionsSchema = z.record(versionName, versionId);
const versionSchema = z.object({
  id: versionId,
  label: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  revision: z.number().int().positive(),
  youtubeId: z.string().refine(isValidYoutubeId).optional(),
});
export const songManifestSchema = z.object({
  songId: segment,
  official: versionName,
  versions: z.record(versionName, versionSchema),
  reserved: reservedVersionsSchema.optional(),
  prompts: z.array(z.object({
    id: segment, songId: segment, text: z.string(),
    summaryPromptVersion: z.string(), summaryModel: z.string(),
    createdAt: z.union([z.string(), z.date(), z.null()]),
    illustrations: z.array(z.object({
      imageModel: z.string().min(1), filename: segment,
      createdAt: z.union([z.string(), z.number(), z.date()]),
    })),
  })),
}).superRefine((manifest, ctx) => {
  if (!Object.hasOwn(manifest.versions, manifest.official)) {
    ctx.addIssue({ code: "custom", message: "Missing official sheet" });
  }
  if (Object.keys(manifest.reserved ?? {}).some(name => Object.hasOwn(manifest.versions, name))) {
    ctx.addIssue({ code: "custom", message: "Version number is both active and reserved" });
  }
  const ids = [...Object.values(manifest.versions).map(version => version.id), ...Object.values(manifest.reserved ?? {})];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Duplicate version ID" });
});

export function eligibleSnapshotVersion(version: {
  status: string;
  mergedIntoVersionId: string | null;
  importId: string | null;
  revision: number;
}): boolean {
  return version.status === "published" && !version.mergedIntoVersionId &&
    (!version.importId || version.revision > 1);
}

type SnapshotVersion = {
  id: string;
  label: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  revision: number;
  youtubeId: string | null;
};

export function assignSnapshotVersions(versions: SnapshotVersion[], previous: Record<string, string> = {}) {
  const existing = Object.entries(previous);
  const byId = new Map(existing.map(([name, id]) => [id, name]));
  if (byId.size !== existing.length) throw new Error("Duplicate version ID in prior assignments");
  let last = existing.reduce((max, [name]) => Math.max(max, Number(name.slice(1))), 0);
  const ordered = [...versions].sort((a, b) =>
    a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const entries = ordered.map(version => {
    const name = byId.get(version.id) ?? `v${++last}`;
    return [name, {
      id: version.id,
      label: version.label ?? undefined,
      description: version.description ?? undefined,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
      revision: version.revision,
      youtubeId: version.youtubeId ?? undefined,
    }] as const;
  });
  entries.sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
  const active = Object.fromEntries(entries);
  const reserved = Object.fromEntries(existing.filter(([name]) => !Object.hasOwn(active, name)));
  return { versions: active, reserved: Object.keys(reserved).length ? reserved : undefined };
}

const headers = new Set(["title", "artist", "key", "capo", "tempo", "range", "language",
  "startMelody", "createdAt", "updatedAt", "illustrationId", "promptId"]);
export function parseSnapshotSheet(content: string) {
  const lines = content.split("\n");
  const metadata: Record<string, string> = {};
  let bodyStart = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { bodyStart++; continue; }
    const match = trimmed.match(/^\{([^:]+):\s*(.+)\}$/);
    if (!match || !headers.has(match[1])) break;
    metadata[match[1]] = match[2].trim();
    bodyStart++;
  }
  if (!metadata.title || !metadata.artist) throw new Error("Missing title or artist");
  return { metadata, chordpro: lines.slice(bodyStart).join("\n").trim() };
}
