// Converts song text with chord lines (Ultimate Guitar, pisnicky-akordy.cz...) into ChordPro format

interface Token {
  text: string;
  position: number;
}

interface PlaceChordResult {
  text: string;
  placed: boolean;
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
  
  const chordPattern = /[A-H][#bs]?m?[mi]?[5-7]?/g;

  const chords = line.match(chordPattern) || [];
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

function placeChord(chordToken: Token, lyricToken: Token): PlaceChordResult {
  /**
   * Returns the string and if it placed the chord
   */
  const word = lyricToken.text;
  const wordStartPos = lyricToken.position;
  const chord = chordToken.text;
  const chordPos = chordToken.position;

  // Even if the word fits, force the chords in front of prepositions
  if (chordPos - (wordStartPos + word.length) >= 0) {
    return { text: `${word} `, placed: false };
  }
  // Move the chords at the start of word
  else if (
    chordPos - wordStartPos <= 2 ||
    (chordPos - wordStartPos <= 3 && word.length === 3)
  ) {
    return { text: `[${chord}]${word} `, placed: true };
  } else {
    const wordSplitIdx = chordPos - wordStartPos;
    return {
      text: `${word.slice(0, wordSplitIdx)}[${chord}]${word.slice(
        wordSplitIdx
      )} `,
      placed: true,
    };
  }
}

function insertChordsInLyrics(chordLine: string, lyricLine: string): string {
  /**
   * Inserts chords into the lyrics at the correct positions based on word boundaries.
   * If the chord position is within 2 characters of the word's start, the chord is placed before the word.
   */
  const result: string[] = [];

  const lyricTokens = tokenizeWithPositions(lyricLine);
  const chordTokens = tokenizeWithPositions(chordLine);

  let tokenIndex = 0;

  for (const chordToken of chordTokens) {
    if (tokenIndex >= lyricTokens.length) {
      result.push(`[${chordToken.text}]`);
      continue;
    }

    let chordPlaced = false;
    while (!chordPlaced && tokenIndex < lyricTokens.length) {
      const placeResult = placeChord(chordToken, lyricTokens[tokenIndex]);
      tokenIndex++;
      result.push(placeResult.text);
      chordPlaced = placeResult.placed;
    }
  }

  // Add any remaining lyric tokens after all chords have been inserted
  if (tokenIndex < lyricTokens.length) {
    for (let i = tokenIndex; i < lyricTokens.length; i++) {
      result.push(lyricTokens[i].text + " ");
    }
  }

  return result.join("");
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
  /**
   * Adds ChordPro directives based on verse and chorus markers.
   */
  const outputLines: string[] = [];

  if (paragraph.length === 0) {
    return [];
  }

  const firstLine = paragraph[0].trim();

  const verseMatch = firstLine.match(/^\d+\.\s/);
  const chorusMatch = firstLine.match(/^(R\d*|Ref\.?|Chorus|Refrain):\s*/i);
  const bridgeMatch = firstLine.match(/^(B\d*|Bridge):\s*/);

  // Detect choruses (e.g., "R: ")
  if (chorusMatch) {
    if (firstLine === chorusMatch[0].trim()) {
      outputLines.push("{chorus}");
    } else {
      outputLines.push("{start_of_chorus}");
      for (let i = 0; i < paragraph.length; i++) {
        const line = paragraph[i];
        if (i === 0) {
          outputLines.push(line.slice(chorusMatch[0].length).trim());
        } else {
          outputLines.push(line);
        }
      }
      outputLines.push("{end_of_chorus}");
    }
  }
  // Detect bridges
  else if (bridgeMatch) {
    if (firstLine === bridgeMatch[0].trim()) {
      outputLines.push("{bridge}");
    } else {
      outputLines.push("{start_of_bridge}");
      for (let i = 0; i < paragraph.length; i++) {
        const line = paragraph[i];
        if (i === 0) {
          outputLines.push(line.slice(bridgeMatch[0].length).trim());
        } else {
          outputLines.push(line);
        }
      }
      outputLines.push("{end_of_bridge}");
    }
  } else {
    outputLines.push("{start_of_verse}");
    if (verseMatch) {
      // remove the verse number of pisnicky-akordy
      for (let i = 0; i < paragraph.length; i++) {
        const line = paragraph[i];
        if (i === 0) {
          outputLines.push(line.slice(verseMatch[0].length).trim());
        } else {
          outputLines.push(line);
        }
      }
    } else {
      outputLines.push(...paragraph);
    }
    outputLines.push("{end_of_verse}");
  }

  return outputLines;
}

function processParagraph(songLines: string[]): string {
  /**
   * Processes an entire paragraph by detecting chord and lyric lines, inserting chords into the lyrics,
   * and adding ChordPro directives for verses and choruses.
   */
  let chordLine: string | null = null;
  const structuredSong: string[] = [];

  for (const line of songLines) {
    if (isChordLine(line)) {
      chordLine = line;
    } else {
      if (chordLine) {
        const chordproLine = insertChordsInLyrics(chordLine, line);
        structuredSong.push(chordproLine);
        chordLine = null;
      } else {
        structuredSong.push(line.trim());
      }
    }
  }

  const chordproResult = addChordproDirectives(structuredSong);
  return chordproResult.join("\n");
}

function processSong(songLines: string[]): string {
  const paragraphs = groupLinesIntoParagraphs(songLines);
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const processed = processParagraph(paragraph);
    result.push(processed);
  }

  return result.join("\n\n");
}

function isConvertibleFormat(text: string): boolean {
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
        console.log(line)
        chordLineCount++;
      }
    }
  }
  // Consider it convertible if at least 10% of non-empty lines are chord lines
  // and there are at least 2 chord lines
  console.log(chordLineCount)
  return chordLineCount >= 2 && chordLineCount / nonEmptyLineCount >= 0.1;
}

function convertToChordPro(songText: string): string {
  /**
   * Main conversion function that takes song text as input
   * and returns ChordPro formatted text.
   */
  const songLines = songText.split("\n");
  return processSong(songLines);
}

// Example usage:
// const songText = `...your song text here...`;
// if (isConvertibleFormat(songText)) {
//   const chordproOutput = convertToChordPro(songText);
//   console.log(chordproOutput);
// }

export {
  isChordLine,
  tokenizeWithPositions,
  placeChord,
  insertChordsInLyrics,
  groupLinesIntoParagraphs,
  addChordproDirectives,
  processParagraph,
  processSong,
  isConvertibleFormat,
  convertToChordPro,
};
