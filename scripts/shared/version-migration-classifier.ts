// Historical migration policy, separate from the editor's small-edit advice.
// Transposition, capo and chord corrections normally remain revisions.
// Large chorus/repeat rewrites need review even if the remaining lyrics match.
// These thresholds are provisional until the migration examples are reviewed.
export function migrationLyrics(sheet: string): string[] {
  return sheet
    .replace(/\{(?:start_of_tab|sot)\}[^]*?\{(?:end_of_tab|eot)\}/gi, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\[[^\]]*\]/g, "") // A chord inside a word must not split the word.
    .normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .match(/\p{L}+/gu) ?? [];
}

export function classifyVersionMigration(before: string, after: string) {
  const a = migrationLyrics(before), b = migrationLyrics(after);
  const pairs = (words: string[]) => new Set(words.slice(1).map((word, i) => `${words[i]} ${word}`));
  const left = pairs(a), right = pairs(b);
  const shared = [...left].filter((pair) => right.has(pair)).length;
  const overlap = shared / Math.max(left.size, right.size, 1);
  const identicalLyrics = a.length > 0 && a.join(" ") === b.join(" ");
  const identicalSheet = before.trim() === after.trim();
  const references = (sheet: string) => (sheet.match(/\{(?:chorus|verse|bridge|interlude)(?::[^}]*)?\}/gi) ?? []).length;
  const structuralRewrite = references(before) !== references(after)
    && Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1) > 0.2;
  const revision = !structuralRewrite && (identicalSheet || identicalLyrics || (Math.min(a.length, b.length) >= 12 && overlap >= 0.75));
  return {
    decision: revision ? "revision" as const : "review" as const,
    reason: structuralRewrite ? "Large chorus/repeat restructuring" : identicalSheet ? "Identical sheet" : identicalLyrics ? "Same normalized lyrics" : revision ? "Substantially shared lyrics" : "Check song identity or substantial lyric changes",
    overlap,
    wordsBefore: a.length,
    wordsAfter: b.length,
  };
}
