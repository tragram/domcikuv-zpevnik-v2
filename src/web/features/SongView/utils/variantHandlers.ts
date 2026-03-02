// these are used to pass information about collapsed/shorthand sections to post-processing
// this is an ugly solution but the alternative appears to be writing my own parser
export const EXPANDED_SECTION_DIRECTIVE = "{comment: %expanded_section%}";
export const SHORTHAND_SECTION_DIRECTIVE = "{comment: %shorthand_section%}";

export type VariantHandler = (
  originalLines: string[],
  variantContent: string[],
  repeat: boolean,
  sectionTitle: string,
  args: string[],
) => string[];

function getLyricStartIdx(lines: string[]) {
  return lines[1]?.startsWith("{comment: %section_title") ? 2 : 1;
}

export const variantHandlers: Record<string, VariantHandler> = {
  replace_last_line: (lines, content, repeat, sectionTitle) => {
    if (repeat) {
      const lyricStartIdx = getLyricStartIdx(lines);
      return [
        lines[0],
        sectionTitle,
        ...lines.slice(lyricStartIdx, -2),
        content[0],
        ...lines.slice(-1),
      ];
    } else {
      return [lines[0], sectionTitle, "..." + content[0], ...lines.slice(-1)];
    }
  },

  replace_last_n_lines: (lines, content, repeat, sectionTitle, args) => {
    const n = parseInt(args[0] || "1", 10);
    const lyricStartIdx = getLyricStartIdx(lines);
    const totalLyrics = lines.length - 1 - lyricStartIdx;
    const linesToReplace = Math.min(n, Math.max(0, totalLyrics));

    if (repeat) {
      return [
        lines[0],
        sectionTitle,
        ...lines.slice(lyricStartIdx, -(linesToReplace + 1)),
        content[0],
        ...lines.slice(-1),
      ];
    } else {
      return [lines[0], sectionTitle, "..." + content[0], ...lines.slice(-1)];
    }
  },

  append_content: (lines, content, repeat, sectionTitle) => {
    if (repeat) {
      const lyricStartIdx = getLyricStartIdx(lines);
      return [
        lines[0],
        sectionTitle,
        ...lines.slice(lyricStartIdx, -1),
        content[0],
        ...lines.slice(-1),
      ];
    } else {
      return [lines[0], sectionTitle, "+ " + content[0], ...lines.slice(-1)];
    }
  },

  replace_first_line: (lines, content, repeat, sectionTitle) => {
    if (repeat) {
      const lyricStartIdx = getLyricStartIdx(lines);
      return [
        lines[0],
        sectionTitle,
        content[0],
        ...lines.slice(lyricStartIdx + 1, -1),
        ...lines.slice(-1),
      ];
    } else {
      return [
        lines[0],
        sectionTitle,
        content[0].trim() + "...",
        ...lines.slice(-1),
      ];
    }
  },

  prepend_content: (lines, content, repeat, sectionTitle) => {
    const lyricStartIdx = getLyricStartIdx(lines);
    if (repeat) {
      return [
        lines[0],
        sectionTitle,
        content[0],
        ...lines.slice(lyricStartIdx, -1),
        ...lines.slice(-1),
      ];
    } else {
      return [
        lines[0],
        sectionTitle,
        content[0] + "+",
        ...lines.slice(lyricStartIdx, -1),
        ...lines.slice(-1),
      ];
    }
  },
};

export function applyVariant(
  originalLines: string[],
  variantType: string,
  variantContent: string[],
  repeat: boolean,
  sectionTitle: string,
  args: string[] = [],
): string[] {
  const handler = variantHandlers[variantType];

  // Graceful fallback: if handler is missing or content is broken
  if (!handler || originalLines.length < 3) {
    return [
      ...originalLines,
      `{comment: Warning: Unprocessed or Invalid Variant (${variantType})}`,
      ...variantContent,
    ];
  }

  // Handle multi-line variant content by joining
  const normalizedContent =
    variantContent.length > 1
      ? [variantContent.join("\n").trim()]
      : variantContent;

  const modifiedLines = handler(
    originalLines,
    normalizedContent,
    repeat,
    sectionTitle,
    args,
  );

  // Inject meta information tag
  return modifiedLines.toSpliced(
    1,
    0,
    repeat ? EXPANDED_SECTION_DIRECTIVE : SHORTHAND_SECTION_DIRECTIVE,
  );
}