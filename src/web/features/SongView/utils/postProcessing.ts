import { EMPTY_LINE } from "./preparseChordpro";
import {
  EXPANDED_SECTION_DIRECTIVE,
  SHORTHAND_SECTION_DIRECTIVE,
} from "./variantHandlers";

interface ChordElement {
  element: Element;
  chord: string;
}

interface ChordMatch {
  /** For each chord of the current section: does it align with an identical chord in the pattern? */
  matches: boolean[];
  /** Edit distance between the pattern and the current chords (substitutions + insertions + deletions) */
  distance: number;
}

const MAX_CHORD_MATCH_DISTANCE = 3;
const DEFAULT_SECTION_TYPES = ["verse", "chorus", "bridge", "interlude"];

/**
 * Maximum number of chord edits for a section to still count as a repeat of an
 * earlier one. Scales with section length so that short sections only match
 * (nearly) exactly — with a flat cap, a 2-chord verse would "repeat" any other
 * 2-chord verse no matter its chords.
 */
function maxAllowedDistance(chordCount: number): number {
  return Math.min(MAX_CHORD_MATCH_DISTANCE, Math.floor(chordCount / 3));
}

/**
 * Marks sections whose chords repeat an earlier section of the same type with
 * the `repeated-chords` class; chords that differ from the matched pattern get
 * `force-shown` so they stay visible when repeated chords are hidden.
 *
 * 2-Pass Optimization: Reads DOM state first, caches modifications, then applies them all at once.
 */
function detectRepeatedChordPatterns(
  doc: Document,
  classNames = DEFAULT_SECTION_TYPES,
): Document {
  // Seen chord patterns per section type; labels are irrelevant — the feature
  // is purely about chords repeating, whatever section they came from.
  const seen: { [sectionType: string]: string[][] } = {};
  classNames.forEach((className) => {
    seen[className] = [];
  });

  const selector = classNames.map((className) => `.${className}`).join(",");
  const sections = Array.from(doc.querySelectorAll(selector));

  // Array to batch DOM writes
  const mutations: Array<() => void> = [];

  // Phase 1: Analyze / Read
  sections.forEach((element) => {
    const elementClass = classNames.find((className) =>
      element.classList.contains(className),
    );
    if (!elementClass) return;

    // keep track of elements as well as chords to be able to highlight changes later
    const chordsWElements: ChordElement[] = [];
    for (const chordElement of Array.from(element.querySelectorAll(".chord"))) {
      const chord = chordElement.textContent?.trim();
      if (chord) {
        chordsWElements.push({ element: chordElement, chord });
      }
    }
    if (chordsWElements.length === 0) return;

    const onlyChords = chordsWElements.map((c) => c.chord);
    const matchResult = findBestChordPatternMatch(
      onlyChords,
      seen[elementClass],
    );

    // Remember every new variation so later sections can match it
    if (matchResult.distance > 0) {
      seen[elementClass].push(onlyChords);
    }

    if (matchResult.distance > maxAllowedDistance(onlyChords.length)) return;

    // Sections without lyrics would render empty with their chords hidden
    const hasLyrics = Array.from(element.querySelectorAll(".lyrics")).some(
      (el) => el.textContent?.trim(),
    );
    if (!hasLyrics) return;

    // Queue DOM modifications instead of executing them immediately
    mutations.push(() => {
      element.classList.add("repeated-chords");
      matchResult.matches.forEach((matched, index) => {
        if (!matched) {
          chordsWElements[index].element.classList.add("force-shown");
        }
      });
    });
  });

  // Phase 2: Mutate / Write
  mutations.forEach((mutate) => mutate());

  return doc;
}

/**
 * Finds the best matching chord pattern from previously seen patterns
 * @param currentChords - Array of current chord names
 * @param knownPatterns - Array of previously seen chord patterns
 * @returns The best matching pattern with distance measure
 */
function findBestChordPatternMatch(
  currentChords: string[],
  knownPatterns: string[][],
): ChordMatch {
  let bestMatch: ChordMatch = { matches: [], distance: Infinity };
  for (let i = 0; i < knownPatterns.length; i++) {
    const match = compareChordLists(knownPatterns[i], currentChords);
    if (match.distance < bestMatch.distance) bestMatch = match;
  }
  return bestMatch;
}

/**
 * Compares the current chords against a reference pattern using edit-distance
 * alignment, so one inserted or removed chord doesn't shift-mismatch
 * everything after it (as a position-by-position comparison would).
 *
 * Exported for tests.
 *
 * @param pattern - Reference chord list (from a previously seen section)
 * @param currentChords - Chord list of the section being examined
 * @returns Per-current-chord match flags and the total edit distance
 */
export function compareChordLists(
  pattern: string[],
  currentChords: string[],
): ChordMatch {
  const m = pattern.length;
  const n = currentChords.length;

  // dp[i][j] = edit distance between pattern[0..i) and currentChords[0..j)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (pattern[i - 1] === currentChords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrace the alignment to flag which current chords sit on exact matches
  const matches: boolean[] = new Array(n).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (
      pattern[i - 1] === currentChords[j - 1] &&
      dp[i][j] === dp[i - 1][j - 1]
    ) {
      matches[j - 1] = true;
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j - 1] + 1) {
      // substitution
      i--;
      j--;
    } else if (dp[i][j] === dp[i][j - 1] + 1) {
      // chord inserted into the current section
      j--;
    } else {
      // chord removed from the pattern
      i--;
    }
  }

  return { matches, distance: dp[m][n] };
}

/**
 * Processes HTML content to handle expanded/shorthand section directives
 *
 * @param htmlString - The HTML string to process
 * @returns Processed HTML with appropriate classes added and comments removed
 */
function processExpandedSections(doc: Document): Document {
  const commentElements = Array.from(doc.querySelectorAll(".comment"));
  const mutations: Array<() => void> = [];

  commentElements.forEach((element) => {
    if (!element.textContent) return;
    const commentText = element.textContent.trim();
    const isEmptyLine = `{comment: ${commentText}}` === EMPTY_LINE;
    // Check if it's one of our directive comments
    const isExpandedDirective =
      `{comment: ${commentText}}` === EXPANDED_SECTION_DIRECTIVE;
    const isShorthandDirective =
      `{comment: ${commentText}}` === SHORTHAND_SECTION_DIRECTIVE;

    if (isEmptyLine) {
      mutations.push(() => {
        const emptyLineDiv = doc.createElement("div");
        emptyLineDiv.className = "empty-line";

        // Target the parent row if it exists to cleanly remove the wrapper,
        // otherwise just target the comment element itself.
        const targetElement = element.closest(".row") || element;

        if (targetElement.parentNode) {
          targetElement.parentNode.replaceChild(emptyLineDiv, targetElement);
        }
      });
    } else if (isExpandedDirective || isShorthandDirective) {
      const paragraph = element.closest(".paragraph");
      const directiveRow = element.closest(".row");

      if (paragraph && directiveRow) {
        mutations.push(() => {
          // 1. Identify external rows ChordSheetJS greedily merged
          const siblingsToEject: Node[] = [];
          let current = paragraph.firstChild;

          // Because our directive is injected immediately after the start tag,
          // anything preceding it in the DOM must be an external element.
          while (current && current !== directiveRow) {
            siblingsToEject.push(current);
            current = current.nextSibling;
          }

          // 2. Eject them into a preceding standalone paragraph
          if (siblingsToEject.length > 0) {
            const externalPara = doc.createElement("div");
            // Wrap in 'paragraph' so it flows correctly, plus a custom class for styling
            externalPara.className = "paragraph standalone-comments";
            paragraph.parentNode?.insertBefore(externalPara, paragraph);
            siblingsToEject.forEach((node) => externalPara.appendChild(node));
          }

          // 3. Apply standard visibility classes
          if (isExpandedDirective) {
            paragraph.classList.add("expanded-section");
          } else {
            paragraph.classList.add("shorthand-section");
          }

          // 4. Clean up the internal directive tag
          element.remove();
        });
      }
    }
  });
  mutations.forEach((mutate) => mutate());
  return doc;
}
function processSectionTitles(doc: Document): Document {
  const commentElements = Array.from(doc.querySelectorAll(".comment"));

  // We execute these directly since creation and insertion is complex and doesn't heavily read the DOM
  commentElements.forEach((element) => {
    if (!element.textContent) return;
    const commentText = element.textContent.trim();
    const sectionTitlePattern = /%\s*section_title:\s*(.*?)\s*%/;
    const match = commentText.match(sectionTitlePattern);

    if (match) {
      const commentRow = element.closest(".row");

      let lyricsLineElement = commentRow?.nextElementSibling;
      while (lyricsLineElement) {
        if (
          lyricsLineElement instanceof HTMLDivElement &&
          lyricsLineElement.classList.contains("row")
        )
          break;
        lyricsLineElement = lyricsLineElement.nextElementSibling;
      }

      // Create the section title div
      const sectionTitleDiv = doc.createElement("div");
      sectionTitleDiv.className = "section-title";
      sectionTitleDiv.textContent = match[1] + ": ";

      // Create the word div that will contain the section title
      const wordDiv = doc.createElement("div");
      wordDiv.className = "column";
      wordDiv.appendChild(sectionTitleDiv);

      if (lyricsLineElement && lyricsLineElement instanceof HTMLDivElement) {
        // Insert the word div as the first child of the lyrics-line div
        lyricsLineElement.insertBefore(wordDiv, lyricsLineElement.firstChild);
      } else {
        // If no lyrics-line div exists, create one
        const newLyricsDiv = doc.createElement("div");
        newLyricsDiv.className = "row";
        // Add the word div containing the section title as its first child
        newLyricsDiv.appendChild(wordDiv);
        // Insert the new lyrics-line div after the comment

        const parent = commentRow?.parentNode;
        if (parent && commentRow)
          parent.insertBefore(newLyricsDiv, commentRow.nextSibling);
      }
      commentRow?.remove();
    }
  });

  return doc;
}

/**
 * Adds repeat classes to chord sections and processes repetitions etc.
 * @param htmlString - HTML string to process
 * @param classNames - Section class names to process
 * @returns Processed HTML string
 */
export function postProcessChordPro(
  htmlString: string,
  classNames = DEFAULT_SECTION_TYPES,
): string {
  const parser = new DOMParser();
  let doc = parser.parseFromString(htmlString, "text/html");

  doc = processExpandedSections(doc);
  doc = processSectionTitles(doc);
  const processedDoc = detectRepeatedChordPatterns(doc, classNames);

  return processedDoc.body.innerHTML;
}
