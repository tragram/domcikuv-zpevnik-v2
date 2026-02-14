// Converts song text with chord lines (Ultimate Guitar, pisnicky-akordy.cz...) into ChordPro format

import { convertChordNotation } from "~/features/SongView/utils/chordNotation";

interface Token {
  text: string;
  position: number;
}

function isChordLine(line: string): boolean {
  /**
   * Detects if a line is likely to be a chord line.
   * Chord lines generally contain chord names like 'A', 'G#m', etc.
   * Excludes lines with ChordPro format chords ([C], [G#m], etc.)
   */

  // First check if line contains ChordPro format chords
  if (/\[[A-H][#bs]?m?[mi]?[5-7]?\]/.test(line)) {
    return false;
  }

  const chordPattern =
    /[A-H][#bs]?(?:m|mi|maj|min|sus|dim|aug)?[0-9]*(?:\/[A-H][#b]?)?/g;

  const chords = line.match(chordPattern) || [];
  // there should not be any words
  const words = line.split(/\s+/).filter((w) => w.length > 0);

  return chords.length > 0 && chords.length >= words.length / 2;
}

function tokenizeWithPositions(text: string): Token[] {
  /**
   * Tokenizes a string into words and spaces, while keeping track of their start positions.
   * Returns a list of tokens with their start positions.
   */
  const tokens: Token[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({
      text: match[0],
      position: match.index,
    });
  }

  return tokens;
}

function placeChords(lyricToken: Token, chordTokens: Token[]): string {
  /**
   * Returns the string and if it placed the chord
   * If the chord position is within 2 characters of the word's start, the chord is placed before the word.
   */

  let word = lyricToken.text;
  const wordStartPos = lyricToken.position;
  const adjustChordPosition = (chordToken: Token) => {
    // heuristics to avoid minor misalignments at the start and end
    const chordPos = chordToken.position;

    // move to word start if after first letter or it's a short word
    if (
      chordPos - wordStartPos < 2 ||
      (chordPos - wordStartPos === 2 && word.length === 2) ||
      (chordPos - wordStartPos === 3 && word.length === 3)
    ) {
      chordToken.position = wordStartPos;
    }
    return chordToken;
  };

  // do not use heuristics when more than one chord is being inserted in a single word
  if (chordTokens.length < 2)
    chordTokens = chordTokens.map(adjustChordPosition);

  // insert chords from back to front so that we do not mess up the alignment
  for (const chordToken of chordTokens.toReversed()) {
    const insertPos = chordToken.position - wordStartPos;
    word = `${word.slice(0, insertPos)}[${chordToken.text}]${word.slice(
      insertPos,
    )}`;
  }
  return word;
}

export function normalizeChordTokens(
  tokens: Token[],
  convertToCzechNotation: boolean = false,
): Token[] {
  return tokens.map((token) => {
    let text = token.text.trim();

    while (text.endsWith(",") || text.endsWith(".")) {
      text = text.slice(0, -1).trimEnd();
    }

    // Apply the conversion here
    if (convertToCzechNotation) {
      text = convertChordNotation(text);
    }

    return { ...token, text };
  });
}

function insertChordsInLyrics(
  chordLine: string,
  lyricLine: string,
  convertToCzechNotation: boolean,
): string {
  /**
   * Inserts chords into the lyrics at the correct positions based on word boundaries.
   */
  const result: string[] = [];

  const lyricTokens = tokenizeWithPositions(lyricLine);
  const chordTokens = normalizeChordTokens(
    tokenizeWithPositions(chordLine),
    convertToCzechNotation,
  );
  let chordTokenIndex = 0;
  for (const lyricToken of lyricTokens) {
    const chordsToInsert = [];
    const lyricTokenEnd = lyricToken.position + lyricToken.text.length;
    while (
      chordTokenIndex < chordTokens.length &&
      chordTokens[chordTokenIndex].position < lyricTokenEnd
    ) {
      chordsToInsert.push(chordTokens[chordTokenIndex]);
      chordTokenIndex++;
    }
    result.push(placeChords(lyricToken, chordsToInsert));
  }

  // when we run out of lyrics, just print all the remaining chords
  while (chordTokenIndex < chordTokens.length) {
    result.push(`[${chordTokens[chordTokenIndex].text}]`);
    chordTokenIndex++;
  }

  return result.join(" ");
}

function groupLinesIntoParagraphs(songLines: string[]): string[][] {
  /**
   * Groups song lines into paragraphs
   */
  const paragraphs: string[][] = [];
  let paragraph: string[] = [];

  for (const line of songLines) {
    if (line.trim() === "") {
      if (paragraph.length > 0) {
        paragraphs.push(paragraph);
        paragraph = [];
      }
    } else {
      paragraph.push(line);
    }
  }

  if (paragraph.length > 0) {
    paragraphs.push(paragraph);
  }
  return paragraphs;
}

function addChordproDirectives(paragraph: string[]): string[] {
  if (paragraph.length === 0) return [];

  const firstLine = paragraph[0].trim();
  const verseMatch = firstLine.match(/^\d+\.\s/);
  const chorusMatch = firstLine.match(/^(R\d*|Ref\.?|Chorus|Refrain):\s*/i);
  const bridgeMatch = firstLine.match(/^(B\d*|Bridge):\s*/i);

  // Helper function to handle wrapping logic
  const wrapSection = (
    type: string,
    match: RegExpMatchArray | null,
    isChorusOrBridge: boolean,
  ) => {
    const outputLines: string[] = [];

    if (match && firstLine === match[0].trim() && isChorusOrBridge) {
      // Handle single-line references like "R:"
      return [`{${type}}`];
    }

    outputLines.push(`{start_of_${type}}`);
    for (let i = 0; i < paragraph.length; i++) {
      if (i === 0 && match) {
        // Strip the marker from the first line
        outputLines.push(paragraph[i].slice(match[0].length).trim());
      } else {
        outputLines.push(paragraph[i]);
      }
    }
    outputLines.push(`{end_of_${type}}`);

    // Filter out any empty lines resulting from stripping markers
    return outputLines.filter((line) => line.trim() !== "");
  };

  if (chorusMatch) return wrapSection("chorus", chorusMatch, true);
  if (bridgeMatch) return wrapSection("bridge", bridgeMatch, true);
  return wrapSection("verse", verseMatch, false);
}

function processParagraph(
  songLines: string[],
  convertToCzechNotation: boolean,
): string {
  /**
   * Processes an entire paragraph by detecting chord and lyric lines, inserting chords into the lyrics,
   * and adding ChordPro directives for verses and choruses.
   */
  let chordLineToInsert: string | null = null;
  const structuredSong: string[] = [];

  for (const line of songLines) {
    if (isChordLine(line)) {
      if (chordLineToInsert) {
        // make sure chords are not deleted even if no lyrics are detected
        structuredSong.push(
          insertChordsInLyrics(chordLineToInsert, "", convertToCzechNotation),
        );
      }
      chordLineToInsert = line;
    } else {
      if (chordLineToInsert) {
        const chordproLine = insertChordsInLyrics(
          chordLineToInsert,
          line,
          convertToCzechNotation,
        );
        structuredSong.push(chordproLine);
        chordLineToInsert = null;
      } else {
        structuredSong.push(line.trim());
      }
    }
  }

  if (chordLineToInsert) {
    // make sure chords are not deleted even if no lyrics are detected
    structuredSong.push(
      insertChordsInLyrics(chordLineToInsert, "", convertToCzechNotation),
    );
  }

  const chordproResult = addChordproDirectives(structuredSong);
  return chordproResult.join("\n");
}

function processSong(
  songLines: string[],
  convertToCzechNotation: boolean,
): string {
  const paragraphs = groupLinesIntoParagraphs(songLines);
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const processed = processParagraph(paragraph, convertToCzechNotation);
    result.push(processed);
  }

  return result.join("\n\n");
}

export function isConvertibleFormat(text: string): boolean {
  /**
   * Detects whether the text is in a format suitable for conversion to ChordPro.
   * Returns true if the text contains chord lines that can be converted.
   */
  const lines = text.split("\n");
  let chordLineCount = 0;
  let nonEmptyLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      nonEmptyLineCount++;
      if (isChordLine(line)) {
        chordLineCount++;
      }
    }
  }
  // Consider it convertible if at least 10% of non-empty lines are chord lines
  // and there are at least 2 chord lines
  return chordLineCount >= 2 && chordLineCount / nonEmptyLineCount >= 0.1;
}

export function convertToChordPro(
  songText: string,
  convertToCzechNotation: boolean = false,
): string {
  /**
   * Main conversion function that takes song text as input
   * and returns ChordPro formatted text.
   */
  const songLines = songText.split("\n");
  return processSong(songLines, convertToCzechNotation);
}
