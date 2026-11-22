// Stored URLs in D1, older backups, and R2 promotion records can use this prefix.
export const legacyIllustrationPrefix = "/songs/illustrations/";

export function canonicalIllustrationPath(url: string) {
  return url.startsWith(legacyIllustrationPrefix)
    ? "/songs/" + url.slice(legacyIllustrationPrefix.length)
    : url;
}

export const staticIllustrationPath = /^\/songs\/([\w-][\w.-]*)\/([\w-][\w.-]*)\/(full|thumbnail)\/([\w-][\w.-]*\.webp)$/;
