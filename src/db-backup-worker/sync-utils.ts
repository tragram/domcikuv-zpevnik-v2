/**
 * Ensures a string is safe to use as a folder or file name in Git.
 * Strips URLs, slashes, and special characters.
 */
export function sanitizePathSegment(segment: string): string {
  if (!segment) return "unknown";
  return segment
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extracts the correct R2 key, even if wrapped in a Cloudflare image resizing URL.
 */
export function getR2Key(url: string): string {
  let key = url;
  const cgiMatch = key.match(/^\/?cdn-cgi\/image\/[^/]+\/(.+)$/);
  if (cgiMatch) {
    key = cgiMatch[1];
  }
  try {
    return new URL(key).pathname.replace(/^\//, "");
  } catch {
    return key.replace(/^\//, "");
  }
}
