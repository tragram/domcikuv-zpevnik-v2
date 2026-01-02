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
    { regex: /\|\|:\s*([^{}]+?)\s*:\|\|/g, symbols: "𝄆 $1 𝄇" },
    { regex: /\|:\s*([^{}]+?)\s*:\|/g, symbols: "𝄆 $1 𝄇" },
    { regex: /\[:\s*([^{}]+?)\s*:\]/g, symbols: "𝄆 $1 𝄇" },
  ];

  // Process each part, but skip section markers themselves
  return parts
    .map((part) => {
      // Don't process section markers
      if (part.match(/^\{(?:start_of_|end_of_)[^}]+\}$/)) {
        return part;
      }

      let result = part;
      patterns.forEach(({ regex, symbols }) => {
        result = result.replace(regex, symbols);
      });

      return result;
    })
    .join("");
}

export function normalizeWhitespace(content: string): string {
  // Trim leading and trailing whitespace from the entire content
  const trimmed = content.trim();

  // Split content into lines
  const lines = trimmed.split("\n");
  const processed: string[] = [];
  let inSection = false;
  let justEnteredSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const isStartDirective = !!line.match(/^\{start_of_[^}]+\}$/);
    const isEndDirective = !!line.match(/^\{end_of_[^}]+\}$/);
    const isOtherDirective =
      !!line.match(/^\{[^}]+\}$/) && !isStartDirective && !isEndDirective;

    // Handle empty lines
    if (line === "") {
      // Preserve empty lines within sections (but not right after start directive)
      if (inSection && !justEnteredSection) {
        processed.push("");
      }
      continue;
    }

    // Add empty line before start_of directives and other directives (except at the start)
    if ((isStartDirective || isOtherDirective) && processed.length > 0) {
      processed.push("");
    }

    processed.push(line);

    // Track section state
    if (isStartDirective) {
      inSection = true;
      justEnteredSection = true;
    } else if (isEndDirective) {
      inSection = false;
      justEnteredSection = false;
    } else {
      justEnteredSection = false;
    }
  }

  return processed.join("\n");
}

export function parseChordPro(content: string): ParsedChordPro {
  const preamble = extractPreamble(content);
  let chordpro = removePreamble(content);
  chordpro = replaceRepetitions(chordpro);
  chordpro = normalizeWhitespace(chordpro);

  const result: ParsedChordPro = { ...preamble, chordpro };

  return result;
}
