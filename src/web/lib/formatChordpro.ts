const removeWhitespaces = (lines: string[]): string[] => {
  return lines.map((line) => {
    let cleaned = line.trim().replace(/ +/g, " ");
    cleaned = cleaned.replace(/\] /g, "]");
    cleaned = cleaned.replace(/\]𝄇/g, "] 𝄇");
    return cleaned;
  });
};

const replaceRepetitions = (content: string): string => {
  console.log(content)
  return content
    .replace(/\|:([^{}]+?):\|/g, (_, inner) => `𝄆 ${inner.trim()} 𝄇`)
    .replace(/\/:([^{}]+?):\//g, (_, inner) => `𝄆 ${inner.trim()} 𝄇`);
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

  // 2. Capitalize Paragraphs
  let isStartOfParagraph = true;

  processed = processed
    .split("\n")
    .map((line) => {
      // An empty line resets the paragraph capitalization tracker
      if (line.trim() === "") {
        isStartOfParagraph = true;
        return line;
      }

      // Matches leading whitespace, directives {...}, chords [...], or musical repetition markers 𝄆 / 𝄇
      const pattern = /^((?:\s*|\{[^}]*\}|\[[^\]]*\]|𝄆|𝄇)*)(.*)$/;
      const match = line.match(pattern);

      if (match) {
        const prefix = match[1];
        const lyrics = match[2];

        // If there are actual lyrics on this line (not just chords/directives)
        if (lyrics.trim() !== "") {
          if (isStartOfParagraph) {
            // Capitalize the first non-whitespace character
            const capLyrics = lyrics.replace(/(?<!\S)(\S)/, (char: string) =>
              char.toUpperCase(),
            );
            isStartOfParagraph = false; // Turn off until next empty line
            return prefix + capLyrics;
          } else {
            // Leave subsequent lines in the paragraph exactly as they are
            return prefix + lyrics;
          }
        }
      }

      return line;
    })
    .join("\n");

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
