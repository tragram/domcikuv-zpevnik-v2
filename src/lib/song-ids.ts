// Shared client/server helpers defining how song/prompt/illustration ids are
// derived. The formats are a storage contract (R2 folder layout, DB ids), so
// both the worker and the web app must agree on them.

export const to_ascii = (text: string): string => {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const sanitizeId = (id: string) => {
  return to_ascii(id)
    .toLowerCase()
    .replace(/ /g, "_")
    .replace(/[^a-z0-9-_.]+/g, "")
    .replace(/_+/g, "_")
    // Windows cannot check out a directory whose name ends with a period.
    // Internal periods are meaningful (for example, model version numbers).
    .replace(/\.+$/, "");
};

// Existing illustration filenames preserve model case and substitute hyphens.
// Keep this distinct from sanitizeId: changing the rules would rename assets.
export function sanitizePathSegment(segment: string): string {
  if (!segment) return "unknown";
  return segment
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const songBaseId = (title: string, artist: string) =>
  sanitizeId(`${to_ascii(artist)}-${to_ascii(title)}`);

export const defaultPromptId = (
  songId: string,
  summaryModel: string,
  promptVersion: string,
) => sanitizeId(`${songId}_${summaryModel}_${promptVersion}`);

export const promptFolder = (songId: string, promptId: string) =>
  promptId.replace(songId + "_", "");

export const defaultIllustrationId = (promptId: string, imageModel: string) =>
  sanitizeId(`${promptId}_${imageModel}`);
