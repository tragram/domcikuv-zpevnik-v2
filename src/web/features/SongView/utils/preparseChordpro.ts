/**
 * Custom ChordPro Parser
 *
 * This module provides functionality for processing ChordPro files:
 * - Handles custom variant directives
 * - Replaces repeated section directives (like chorus)
 * - Converts Czech music notation to English
 */

import {
  applyVariant,
  EXPANDED_SECTION_DIRECTIVE,
  SHORTHAND_SECTION_DIRECTIVE,
  variantHandlers,
} from "./variantHandlers";
export const SECTION_TITLE_COMMENT = (
  repeatKey: string | null,
  consecutiveModifier: string | null,
) => `{comment: %section_title: ${consecutiveModifier}${repeatKey}%}`;
export const EMPTY_LINE = "{comment: %empty_line%}";
/**
 * Default section directives
 */
const DEFAULT_SECTION_DIRECTIVES = ["chorus", "bridge", "verse"];
const DEFAULT_SECTION_LABELS = ["R", "B", ""];
const DEFAULT_SECTION_SHORTHANDS = ["R", "B", "V"];

// ==================== DIRECTIVE PROCESSING ====================

/**
 * Detects sequences of consecutive identical directive recalls and returns information
 * about them for compression
 *
 * @param content - Content lines to analyze
 * @param position - Current position in content
 * @param callRegex - Regular expression to match directive calls
 * @returns Object with information about consecutive recalls
 */
function detectConsecutiveRecalls(
  content: string[],
  position: number,
  callRegex: RegExp,
): { count: number; key: string; lastIndex: number } {
  let consecutiveRecalls = 0;
  let currentKey = "";
  let lastIndex = position;

  // Look ahead for consecutive recalls of the same directive
  while (lastIndex < content.length) {
    if (!content[lastIndex].trim()) {
      // ignore empty lines
      lastIndex++;
      continue;
    }
    const callMatch = content[lastIndex].match(callRegex);
    if (!callMatch) break;

    const matchKey = callMatch[1] || "";

    // First recall or keys match
    if (consecutiveRecalls === 0 || matchKey === currentKey) {
      consecutiveRecalls++;
      currentKey = matchKey;
      lastIndex++;
    } else {
      break; // Different key, end the streak
    }
  }

  return {
    count: consecutiveRecalls,
    key: currentKey,
    lastIndex: lastIndex - 1,
  };
}

/**
 * Replaces shorthand directives with both their full content and shorthand version.
 * This means that postprocessing needs to be applied to the HTML after parsing by the chordpro parser to hide either one.
 *
 * Compresses consecutive directive recalls.
 *
 * Also replaces custom extensions to the ChordPro format with stuff that can be parsed by a regular ChordPro parser.
 *
 *
 * @param song - The ChordPro song content
 * @param directives - Array of directive names to process
 * @param labels - Array of labels corresponding to directives shown when expanded
 * @param shortHands - Array of shorthand identifiers corresponding to directives shown when collapsed
 * @returns Processed song with expanded directives and compressed recalls
 */
export function preparseDirectives(
  song: string,
  directives: string[] = DEFAULT_SECTION_DIRECTIVES,
  labels: string[] = DEFAULT_SECTION_LABELS,
  shortHands: string[] = DEFAULT_SECTION_SHORTHANDS,
): string {
  // Validate inputs
  if (
    directives.length !== labels.length ||
    directives.length !== shortHands.length
  ) {
    throw new Error(
      "Directives, labels and shortHands must be the same length.",
    );
  }

  // Section content by directive and key. Maps (not plain objects) so user
  // labels like "__proto__" can't collide with Object.prototype
  const directiveMaps: { [directive: string]: Map<string, string[]> } = {};
  // Most recently closed section key per directive, used as recall fallback
  const lastSectionKey: { [directive: string]: string } = {};

  // Create regex patterns for each directive
  const directiveRegexes = directives.map((directive, i) => ({
    directive,
    label: labels[i],
    shortHand: shortHands[i],
    startRegex: new RegExp(
      `^\\{start_of_${directive}(?::\\s*([\\w\\-_+. \\p{L}]+))?\\}`,
      "u",
    ),
    endRegex: new RegExp(`^\\{end_of_${directive}\\}`, "u"),
    callRegex: new RegExp(
      `^\\{${directive}(?::\\s*([\\w\\-_+. \\p{L}]+))?\\}`,
      "u",
    ),
  }));

  // Default key for when none is specified
  // make the default key hopefully weird enough that no chordpro file will include it
  const defaultKey = "a4c0d35c95a63a805915367dcfe6b751";

  // Track current state
  let currentDirective: string | null = null;
  let currentContent: string[] | null = null;
  let currentKey: string | null = null;
  let currentVariationType: string | null = null;
  let currentVariationArgs: string[] = [];
  let currentVariationContent: string[] | null = null;
  let variantActive = false;

  // Regex for variants
  const variantStartRegex =
    /^\{start_of_variant:\s*([\w\-_+]+)(?::\s*(\d+))?\}/;
  const variantEndRegex = /^\{end_of_variant\}/;

  // Process each line of the song
  const processedLines: string[] = [];
  const songLines = song.split("\n");

  let i = 0;
  while (i < songLines.length) {
    const line = songLines[i];

    // Check for variant start
    const variantStartMatch = line.match(variantStartRegex);
    if (variantStartMatch) {
      const type = variantStartMatch[1];
      const arg = variantStartMatch[2];

      if (!variantHandlers[type]) {
        // GRACEFUL FALLBACK: Render invalid variant as a comment, keep the text
        processedLines.push(`{comment: Invalid variant type: ${type}}`);
        currentVariationType = null;
        variantActive = true;
      } else {
        currentVariationType = type;
        currentVariationArgs = arg ? [arg] : [];
        variantActive = true;
      }
      currentVariationContent = [];
      i++;
      continue;
    }

    // Check for variant end
    const variantEndMatch = line.match(variantEndRegex);
    if (variantEndMatch) {
      variantActive = false;
      i++;
      continue;
    }

    // Collect variant content
    if (variantActive) {
      if (currentVariationContent !== null) {
        currentVariationContent.push(line);
      }
      i++;
      continue;
    }

    let directiveMatched = false;
    for (const {
      directive,
      label,
      shortHand,
      startRegex,
      endRegex,
      callRegex,
    } of directiveRegexes) {
      // Directive start
      const startMatch = line.match(startRegex);
      if (startMatch) {
        currentDirective = directive;
        currentKey = startMatch[1] || label || defaultKey;
        currentContent = [line];
        directiveMaps[directive] ??= new Map();
        directiveMatched = true;
        break;
      }

      // Directive end
      const endMatch = line.match(endRegex);
      if (endMatch && currentContent && currentDirective === directive) {
        currentContent.push(line);
        if (!currentKey) currentKey = defaultKey;

        directiveMaps[directive].set(currentKey, currentContent);
        lastSectionKey[directive] = currentKey;

        // Recalls directly below the definition mean "sing this section again
        // right away", so they condense into the definition's own title as a
        // "(Nx)" multiplier instead of separate recall blocks. A pending
        // variant must not be absorbed — it applies to the recall below it.
        let consecutiveModifier = "";
        if (!currentVariationContent || currentVariationContent.length === 0) {
          const consecutiveInfo = detectConsecutiveRecalls(
            songLines,
            i + 1,
            callRegex,
          );
          const recallKey = consecutiveInfo.key || label || defaultKey;
          if (consecutiveInfo.count > 0 && recallKey === currentKey) {
            consecutiveModifier = `(${consecutiveInfo.count + 1}x) `;
            i = consecutiveInfo.lastIndex;
          }
        }

        // The stored copy must keep the plain title — recalls elsewhere in
        // the song reuse it and must not inherit this multiplier
        const emittedContent = [...currentContent];
        if (currentKey !== defaultKey) {
          currentContent.splice(1, 0, SECTION_TITLE_COMMENT(currentKey, ""));
          emittedContent.splice(
            1,
            0,
            SECTION_TITLE_COMMENT(currentKey, consecutiveModifier),
          );
        } else if (consecutiveModifier) {
          emittedContent.splice(
            1,
            0,
            SECTION_TITLE_COMMENT(label, consecutiveModifier),
          );
        }

        processedLines.push(emittedContent.join("\n"));
        currentDirective = null;
        currentContent = null;
        currentKey = null;
        directiveMatched = true;
        break;
      }

      // Check for (consecutive) directive recalls
      const callMatch = line.match(callRegex);
      if (callMatch) {
        if (currentContent !== null) {
          currentContent.push(
            `{comment: Error: Cannot recall from within a section.}`,
          );
          directiveMatched = true;
          break;
        }

        let consecutiveModifier = "";
        // A pending variant applies only to the recall directly below it,
        // so it must not be condensed into a "(Nx)" multiplier
        const consecutiveInfo =
          currentVariationContent && currentVariationContent.length > 0
            ? { count: 1, key: "", lastIndex: i }
            : detectConsecutiveRecalls(songLines, i, callRegex);

        if (consecutiveInfo.count > 1) {
          // We found consecutive recalls of the same directive
          consecutiveModifier = `(${consecutiveInfo.count}x) `;
          i = consecutiveInfo.lastIndex;
        }

        let directiveKey = callMatch[1] || label || defaultKey;
        let contentToInsert: string[] = [];

        const storedContent = directiveMaps[directive]?.get(directiveKey);
        if (storedContent) {
          contentToInsert = [...storedContent];
        } else {
          // GRACEFUL FALLBACK: Attempt to find fallback, otherwise render comment
          const fallbackKey = lastSectionKey[directive];
          const fallbackContent = fallbackKey
            ? directiveMaps[directive]?.get(fallbackKey)
            : undefined;
          if (fallbackKey && fallbackContent) {
            processedLines.push(
              `{comment: Warning: Recalled part "${directiveKey}" not found. Using "${fallbackKey}" instead.}`,
            );
            directiveKey = fallbackKey;
            contentToInsert = [...fallbackContent];
          } else {
            processedLines.push(
              `{comment: Error: Recalled part "${directive}" not found. No previous section recorded.}`,
            );
            processedLines.push(line); // Preserve original line so data isn't lost
            directiveMatched = true;
            break;
          }
        }

        const sectionTitleExpanded = SECTION_TITLE_COMMENT(
          directiveKey === defaultKey ? label : directiveKey,
          consecutiveModifier,
        );
        const sectionTitleShortHand = SECTION_TITLE_COMMENT(
          directiveKey === defaultKey ? shortHand : directiveKey,
          consecutiveModifier,
        );

        // Apply Variant
        if (currentVariationContent && currentVariationContent.length > 0) {
          if (!currentVariationType) {
            // Unrecognized variant, but we collected lines
            processedLines.push(
              `{comment: Warning: Lost variant contents applied here.}`,
            );
            processedLines.push(...currentVariationContent);

            // Check if title comment is already present
            const hasTitle = contentToInsert[1]?.startsWith(
              "{comment: %section_title",
            );

            contentToInsert = [
              contentToInsert[0],
              EXPANDED_SECTION_DIRECTIVE,
              hasTitle ? contentToInsert[1] : sectionTitleExpanded,
              ...contentToInsert.slice(hasTitle ? 2 : 1, -1),
              `{end_of_${directive}}`,
              `{start_of_${directive}}`,
              SHORTHAND_SECTION_DIRECTIVE,
              sectionTitleShortHand,
              `{end_of_${directive}}`,
            ];
          } else {
            const expandedContent = applyVariant(
              contentToInsert,
              currentVariationType,
              currentVariationContent,
              true,
              sectionTitleExpanded,
              currentVariationArgs,
            );
            const shorthandContent = applyVariant(
              contentToInsert,
              currentVariationType,
              currentVariationContent,
              false,
              sectionTitleShortHand,
              currentVariationArgs,
            );
            contentToInsert = expandedContent.concat(shorthandContent);
          }
          currentVariationType = null;
          currentVariationArgs = [];
          currentVariationContent = null;
        } else {
          // Standard Recall
          const singleLineLyric =
            contentToInsert.length === 3 ? contentToInsert[1] : null;

          // Condensed recalls must carry the "(Nx)" marker in the expanded
          // block too, otherwise all repetitions but one silently disappear
          // when sections are shown expanded
          const hasTitle = contentToInsert[1]?.startsWith(
            "{comment: %section_title",
          );
          const expandedBody = consecutiveModifier
            ? [sectionTitleExpanded, ...contentToInsert.slice(hasTitle ? 2 : 1)]
            : contentToInsert.slice(1);

          contentToInsert = [
            contentToInsert[0],
            EXPANDED_SECTION_DIRECTIVE,
            ...expandedBody,
            `{start_of_${directive}}`,
            SHORTHAND_SECTION_DIRECTIVE,
            sectionTitleShortHand,
            ...(singleLineLyric !== null ? [singleLineLyric] : []), // Inject single lyric line if exactly 3 lines long
            `{end_of_${directive}}`,
          ];
        }

        // Use a strict null/undefined check to prevent dropping empty lines ("")
        processedLines.push(
          contentToInsert
            .filter((c) => c !== null && c !== undefined)
            .join("\n"),
        );
        directiveMatched = true;
      }
    }

    // Add regular lines
    if (!directiveMatched) {
      if (currentContent !== null) {
        currentContent.push(line);
      } else if (line !== null && line !== undefined) {
        processedLines.push(line);
      }
    }
    i++;
  }

  // GRACEFUL FALLBACK: unterminated blocks at the end of the song must not
  // swallow the lines collected into them
  if (currentVariationContent && currentVariationContent.length > 0) {
    processedLines.push(
      "{comment: Warning: Unapplied variant contents found at the end of the song.}",
      ...currentVariationContent,
    );
  }
  if (currentContent && currentDirective) {
    if (currentKey && currentKey !== defaultKey) {
      currentContent.splice(1, 0, SECTION_TITLE_COMMENT(currentKey, ""));
    }
    processedLines.push(
      [
        ...currentContent,
        "{comment: Warning: Unclosed section at the end of the song.}",
        `{end_of_${currentDirective}}`,
      ].join("\n"),
    );
  }

  function hideTitles(text: string) {
    const pattern = new RegExp(
      `\\{start_of_(${directives.join("|")}):[^}]*\\}`,
      "g",
    );
    return text.replace(pattern, "{start_of_$1}");
  }

  return (
    processedLines
      .map((l) => (l ? l.trim() : null))
      .filter((p) => p !== null)
      // replace empty lines because chordsheetJS aggressively splits sections into paragraphs
      // (only multi-line blocks, i.e. sections — top-level lines keep their meaning)
      .map((l) =>
        l.includes("\n")
          ? l
              .split("\n")
              .map((line) => (line.trim() === "" ? EMPTY_LINE : line))
              .join("\n")
          : l,
      )
      // hide section titles so chordsheetJS doesn't duplicate them
      .map((l) => hideTitles(l))
      .join("\n")
      .trim()
  );
}

// ==================== NOTATION CONVERSION ====================

/**
 * Converts Czech chord notation to English
 * Specifically: H -> B and B -> Bb
 *
 * @param song - The song content in ChordPro format
 * @returns Processed song with converted notation
 */
export function czechToEnglish(song: string): string {
  // Convert key directive (whitespace after the colon is optional and gets normalized).
  song = song.replace(/\{key:\s*B([ieasm#b]{0,5})\}/g, "{key: Bb$1}");
  song = song.replace(/\{key:\s*H([ieasm#b]{0,5})\}/g, "{key: B$1}");

  // Convert chords with bass notes
  song = song.replace(/\[([A-Za-z\d#b,\s/]{0,10})\/B\]/g, "[$1/Bb]");
  song = song.replace(/\[([A-Za-z\d#b,\s/]{0,10})\/H\]/g, "[$1/B]");

  // Convert regular chords
  song = song.replace(/\[B([A-Za-z\d#b,\s/]{0,10})\]/g, "[Bb$1]");
  song = song.replace(/\[H([A-Za-z\d#b,\s/]{0,10})\]/g, "[B$1]");

  return song;
}
