export const preambleKeywords = [
  "title",
  "artist",
  "key",
  "capo",
  "tempo",
  "language",
];

export type ParsedChordPro = Record<string, string | undefined> & {
  chordpro: string;
};

export function extractPreamble(
  content: string,
): Record<string, string | undefined> {
  console.log(content)
  const preamble: Record<string, string | undefined> = {};
  preambleKeywords.forEach((keyword) => {
    const match = content.match(new RegExp(`{${keyword}:\\s*(.+?)}`, "i"));
    if (match) {
      preamble[keyword] = match[1].trim();
    }
  });
  return preamble;
}

export function removePreamble(content: string): string {
  const keywordRegex = new RegExp(`{(${preambleKeywords.join("|")}):\\s*(.+?)}`, "i");
  return content
    .split("\n")
    .filter((line) => !line.trim().match(keywordRegex))
    .join("\n")
    .trim();
}

export function parseChordPro(content: string): ParsedChordPro {
    const preamble = extractPreamble(content);
    const chordpro = removePreamble(content);
    
    const result: ParsedChordPro = { ...preamble, chordpro };

    return result;
}
