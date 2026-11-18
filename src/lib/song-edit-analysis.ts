// Advice only: size never grants permission or prevents an intentional correction.
const normalize = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .trim()
    .replace(/[ \t]+/g, " ");
export const EDIT_RECOMMENDATION_PROFILE = {
  lyricCap: 20,
  lyricRatio: 0.1,
  chordCap: 8,
  chordRatio: 0.15,
  affectedLines: 6,
};

function distance(a: string[], b: string[], limit: number): number {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  a = a.slice(start);
  b = b.slice(start);
  while (a.length && b.length && a.at(-1) === b.at(-1)) {
    a.pop();
    b.pop();
  }
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(a[i] !== b[j])),
      );
    if (next.every((value) => value > limit)) return limit + 1;
    row = next;
  }
  return row[b.length];
}

function tokens(text: string) {
  const normalized = normalize(text);
  return {
    lyrics: normalized
      .replace(/\{[^}]*\}|\[[^\]]*\]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
    chords: [...normalized.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].trim()),
    structure: [...normalized.matchAll(/\{([^}]*)\}/g)]
      .map((m) => m[1].trim())
      .join("\n"),
    lines: normalized.split("\n").filter(Boolean),
  };
}

export function analyzeSongEdit(before: string, after: string) {
  const a = tokens(before),
    b = tokens(after);
  const profile = EDIT_RECOMMENDATION_PROFILE;
  const lyricLimit = a.lyrics.length
    ? Math.min(
        profile.lyricCap,
        Math.max(1, Math.floor(a.lyrics.length * profile.lyricRatio)),
      )
    : profile.lyricCap;
  const chordLimit = a.chords.length
    ? Math.min(
        profile.chordCap,
        Math.max(1, Math.floor(a.chords.length * profile.chordRatio)),
      )
    : profile.chordCap;
  const lyricChanges = distance(a.lyrics, b.lyrics, lyricLimit);
  const chordChanges = distance(a.chords, b.chords, chordLimit);
  const changedLines =
    a.lines.filter((line, i) => line !== b.lines[i]).length +
    Math.max(0, b.lines.length - a.lines.length);
  const structureChanged = a.structure !== b.structure;
  const large =
    structureChanged ||
    lyricChanges > lyricLimit ||
    chordChanges > chordLimit ||
    (changedLines > profile.affectedLines &&
      (lyricChanges > 0 || chordChanges > 0));
  return {
    large,
    reason: structureChanged
      ? "Section or directive changes: consider a replacement."
      : large
        ? "Substantial changes: consider a replacement."
        : "Small edit: save a revision and keep existing songbook choices.",
  };
}
