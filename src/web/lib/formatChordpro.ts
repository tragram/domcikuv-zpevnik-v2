const removeWhitespaces = (lines: string[]): string[] => {
  return lines.map((line) => {
    let cleaned = line.trim().replace(/ +/g, " ");
    cleaned = cleaned.replace(/\] /g, "]");
    cleaned = cleaned.replace(/\]𝄇/g, "] 𝄇");
    return cleaned;
  });
};

const replaceRepetitions = (content: string): string => {
  return content.replace(/\|:([^{}]+?):\|/g, (_, inner) => {
    return `𝄆 ${inner.trim()} 𝄇`;
  });
};

const capitalizeLyrics = (text: string): string => {
  const tabPattern = /\{start_of_tab\}[\s\S]*?\{end_of_tab\}/g;
  const tabs: Record<string, string> = {};
  let tabCounter = 0;

  // 1. Protect Tabs
  let processed = text.replace(tabPattern, (match) => {
    const placeholder = `__TAB_SECTION_${tabCounter++}__`;
    tabs[placeholder] = match;
    return placeholder;
  });

  // 2. Capitalize Lyrics
  // Group 1: Directives/Newlines, Group 2: Chords, Group 3: Lyrics
  const pattern =
    /((?:^|\n)\s*(?:\{[^}]*\}\s*|\n)\s*)(\[[A-Ha-h0-9#mi\s]*\])?([^\n]*)/g;
  processed = processed.replace(pattern, (_, prefix, chord, lyrics) => {
    const p = prefix || "";
    const c = chord || "";
    const l = lyrics || "";
    // Capitalize first non-whitespace char
    const capLyrics = l.replace(/(?<!\S)(\S)/, (char: string) =>
      char.toUpperCase(),
    );
    return p + c + capLyrics;
  });

  // 3. Restore Tabs
  for (const [key, val] of Object.entries(tabs)) {
    processed = processed.replace(key, val);
  }

  return processed;
};

export const formatChordpro = (content: string): string => {
  const lines = content.split("\n");
  let newContent = removeWhitespaces(lines).join("\n");
  newContent = replaceRepetitions(newContent);
  newContent = capitalizeLyrics(newContent);
  return newContent;
};
