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
  content: string
): Record<string, string | undefined> {
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
  const keywordRegex = new RegExp(
    `{(${preambleKeywords.join("|")}):\\s*(.+?)}`,
    "i"
  );
  return content
    .split("\n")
    .filter((line) => !line.trim().match(keywordRegex))
    .join("\n")
    .trim();
}

export function replaceRepetitions(content: string): string {
  // Handle various repetition patterns:
  // [:  :] - simple repeat
  // |:  :| - bar repeat
  // ||: :|| - double bar repeat
  // Allow spanning multiple lines but not crossing section boundaries
  
  // Split content into sections based on {start_of_*} and {end_of_*}
  const sectionRegex = /(\{(?:start_of_|end_of_)[^}]+\})/g;
  const parts = content.split(sectionRegex);
  const patterns = [
    { regex: /\|\|:\s*([^{}]+?)\s*:\|\|/g, symbols: '𝄆 $1 𝄇' },
    { regex: /\|:\s*([^{}]+?)\s*:\|/g, symbols: '𝄆 $1 𝄇' },
    { regex: /\[:\s*([^{}]+?)\s*:\]/g, symbols: '𝄆 $1 𝄇' },
  ];
  
  // Process each part, but skip section markers themselves
  return parts.map(part => {
    // Don't process section markers
    if (part.match(/^\{(?:start_of_|end_of_)[^}]+\}$/)) {
      return part;
    }
    
    let result = part;
    patterns.forEach(({ regex, symbols }) => {
      result = result.replace(regex, symbols);
    });
    
    return result;
  }).join('');
}

export function parseChordPro(content: string): ParsedChordPro {
  const preamble = extractPreamble(content);
  let chordpro = removePreamble(content);
  chordpro = replaceRepetitions(chordpro);

  const result: ParsedChordPro = { ...preamble, chordpro };

  return result;
}
