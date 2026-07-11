// Tab sections must survive formatting untouched: their whitespace is
// alignment, and tab lines routinely contain |: :| sequences that must not be
// rewritten as repetition markers. They are swapped for directive-shaped
// placeholders so every pass below treats them as opaque directives.
const TAB_SECTION_PATTERN = /\{start_of_tab\}[\s\S]*?\{end_of_tab\}/g;
const TAB_PLACEHOLDER_PATTERN = /\{__tab_section_(\d+)__\}/g;

const protectTabSections = (
  content: string,
): { content: string; tabs: string[] } => {
  const tabs: string[] = [];
  const protectedContent = content.replace(TAB_SECTION_PATTERN, (match) => {
    tabs.push(match);
    return `{__tab_section_${tabs.length - 1}__}`;
  });
  return { content: protectedContent, tabs };
};

const restoreTabSections = (content: string, tabs: string[]): string =>
  // function replacement so "$&"-like sequences in tabs aren't expanded
  content.replace(
    TAB_PLACEHOLDER_PATTERN,
    (match, index) => tabs[Number(index)] ?? match,
  );

const removeWhitespaces = (content: string): string =>
  content
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replace(/ +/g, " ")
        // chords hug the following syllable, except before a repeat-end mark
        .replace(/\] (?!𝄇)/g, "]")
        .replace(/\]𝄇/g, "] 𝄇"),
    )
    .join("\n");

const replaceRepetitions = (content: string): string =>
  content
    .replace(/\|:([^{}]+?):\|/g, (_, inner) => `𝄆 ${inner.trim()} 𝄇`)
    .replace(/\/:([^{}]+?):\//g, (_, inner) => `𝄆 ${inner.trim()} 𝄇`);

// Matches leading whitespace, directives {...}, chords [...], or musical repetition markers 𝄆 / 𝄇
const LINE_PREFIX_PATTERN = /^((?:\s|\{[^}]*\}|\[[^\]]*\]|𝄆|𝄇)*)(.*)$/;

const capitalizeLyrics = (text: string): string => {
  let isStartOfParagraph = true;

  return text
    .split("\n")
    .map((line) => {
      // An empty line resets the paragraph capitalization tracker
      if (line.trim() === "") {
        isStartOfParagraph = true;
        return line;
      }

      const match = line.match(LINE_PREFIX_PATTERN);
      if (!match) return line;
      const [, prefix, lyrics] = match;

      // Lines without lyrics (chords/directives only) don't start a paragraph
      if (lyrics === "" || !isStartOfParagraph) return line;

      isStartOfParagraph = false;
      return prefix + lyrics.charAt(0).toUpperCase() + lyrics.slice(1);
    })
    .join("\n");
};

export const formatChordpro = (content: string): string => {
  const { content: protectedContent, tabs } = protectTabSections(content);
  const formatted = capitalizeLyrics(
    replaceRepetitions(removeWhitespaces(protectedContent)),
  );
  return restoreTabSections(formatted, tabs);
};
