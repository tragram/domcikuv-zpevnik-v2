// Converts song text with chord lines (Ultimate Guitar, pisnicky-akordy.cz...) into ChordPro format

import { convertChordNotation } from "~/features/SongView/utils/chordNotation";

interface Token {
  text: string;
  position: number;
}

function isTabLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 5) return false;

  if (/^[a-gA-G]\s*\|/.test(trimmed)) return true;

  if (
    trimmed.includes("|-") ||
    trimmed.includes("-|") ||
    trimmed.includes("--|") ||
    trimmed.includes("|--")
  ) {
    const dashCount = (trimmed.match(/-/g) || []).length;
    if (dashCount >= 4) return true;
  }
  return false;
}

function isDirectiveLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*(?:\[(.*)\]|\((.*)\))\s*$/);
}

function getEnvironmentDirective(
  line: string,
): { env: string | null; comment: string | null; stripLength: number } | null {
  // Matches numbered verses like "1. ", "12. " ensuring trailing space or end of line
  const verseMatch = line.match(/^\s*(\d+\.)(?:[\s]+|$)/);
  if (verseMatch)
    return { env: "verse", comment: null, stripLength: verseMatch[0].length };

  // Matches "R", "R1:", "Ref:", "Chorus", ensuring it isn't part of a word like "Ricky"
  const chorusMatch = line.match(
    /^\s*(R\d*|Ref\.?|Chorus|Refrain)(?:[\s:]+|$)/i,
  );
  if (chorusMatch)
    return { env: "chorus", comment: null, stripLength: chorusMatch[0].length };

  // Matches "B:", "Bridge 2: "
  const bridgeMatch = line.match(/^\s*(B\d*|Bridge)(?:[\s:]+|$)/i);
  if (bridgeMatch)
    return { env: "bridge", comment: null, stripLength: bridgeMatch[0].length };

  // Bracketed or parenthesized directives [Intro], (Cambio de ritmo)
  const dirMatch = isDirectiveLine(line);
  if (dirMatch) {
    const content = (
      dirMatch[1] !== undefined ? dirMatch[1] : dirMatch[2]
    ).trim();
    const lowerContent = content.toLowerCase();

    // Checks if the bracketed text is a widely recognized environment block
    if (/^(verse|chorus|refrain|bridge)(?:\s*\d*)?$/.test(lowerContent)) {
      const envName = lowerContent.replace(/\s*\d*$/, "");

      return {
        env: envName === "refrain" ? "chorus" : envName,
        comment: null,
        stripLength: line.length,
      };
    } else {
      // Unrecognized directives gracefully become comments
      return {
        env: "verse",
        comment: content,
        stripLength: line.length,
      };
    }
  }

  return null;
}

function getChordTokens(chordLine: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\S+/g;
  let match;

  const strictChord =
    /^[({\[]?([A-H][#b]?(?:m|mi|maj|min|sus|dim|aug|add)?[0-9]*(?:\/[A-H][#b]?)?)[)}\]]?$/;

  while ((match = regex.exec(chordLine)) !== null) {
    const text = match[0];
    const cleanText = text.replace(/[,.]$/, "");
    const chordMatch = strictChord.exec(cleanText);

    if (chordMatch) {
      tokens.push({
        text: chordMatch[1],
        position: match.index + text.indexOf(chordMatch[1]),
      });
    }
  }
  return tokens;
}

function isChordLine(line: string): boolean {
  if (/\[[A-H][#bs]?m?[mi]?[5-7]?\]/.test(line)) return false;
  if (isTabLine(line)) return false;

  const tokens = line.split(/\s+/).filter((w) => w.length > 0);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  let nonChordCount = 0;

  const strictChord =
    /^[({\[]?([A-H][#b]?(?:m|mi|maj|min|sus|dim|aug|add)?[0-9]*(?:\/[A-H][#b]?)?)[)}\]]?$/;
  const allowedExtras = /^(?:[()|%xX~/\\]+|\d+x|N\.?C\.?)$/i;

  for (const token of tokens) {
    const cleanToken = token.replace(/[,.]$/, "");
    if (strictChord.test(cleanToken)) {
      chordCount++;
    } else if (!allowedExtras.test(cleanToken)) {
      nonChordCount++;
    }
  }

  return chordCount > 0 && nonChordCount === 0;
}

function tokenizeWithPositions(text: string): Token[] {
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
  let word = lyricToken.text;
  const wordStartPos = lyricToken.position;
  const adjustChordPosition = (chordToken: Token) => {
    const chordPos = chordToken.position;
    if (
      chordPos - wordStartPos < 2 ||
      (chordPos - wordStartPos === 2 && word.length === 2) ||
      (chordPos - wordStartPos === 3 && word.length === 3)
    ) {
      chordToken.position = wordStartPos;
    }
    return chordToken;
  };

  if (chordTokens.length < 2)
    chordTokens = chordTokens.map(adjustChordPosition);

  for (const chordToken of chordTokens.toReversed()) {
    const insertPos = chordToken.position - wordStartPos;
    word = `${word.slice(0, insertPos)}[${chordToken.text}]${word.slice(insertPos)}`;
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
  const result: string[] = [];
  const lyricTokens = tokenizeWithPositions(lyricLine);
  const chordTokens = normalizeChordTokens(
    getChordTokens(chordLine),
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

  while (chordTokenIndex < chordTokens.length) {
    result.push(`[${chordTokens[chordTokenIndex].text}]`);
    chordTokenIndex++;
  }

  return result.join(" ");
}

function formatStandaloneChordLine(
  line: string,
  convertToCzechNotation: boolean,
): string {
  const tokens = getChordTokens(line);
  let result = line;

  for (const token of tokens.toReversed()) {
    let chordText = token.text;
    if (convertToCzechNotation) {
      chordText = convertChordNotation(chordText);
    }
    result =
      result.slice(0, token.position) +
      `[${chordText}]` +
      result.slice(token.position + token.text.length);
  }

  return result.trimEnd();
}

function groupLinesIntoParagraphs(songLines: string[]): string[][] {
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

  if (paragraph.length > 0) paragraphs.push(paragraph);
  return paragraphs;
}

function processParagraphLines(
  songLines: string[],
  convertToCzechNotation: boolean,
): string {
  const hasTabLine = songLines.some(isTabLine);
  if (hasTabLine) {
    const result: string[] = [];
    let tabStartIndex = 0;

    // Isolate any inline comments before the tab starts
    while (tabStartIndex < songLines.length) {
      const line = songLines[tabStartIndex];
      const dirMatch = isDirectiveLine(line);

      if (dirMatch && !isChordLine(line)) {
        const content = dirMatch[1] !== undefined ? dirMatch[1] : dirMatch[2];
        result.push(`{comment: ${content}}`);
        tabStartIndex++;
      } else {
        break;
      }
    }

    if (tabStartIndex < songLines.length) {
      result.push("{start_of_tab}");
      for (let i = tabStartIndex; i < songLines.length; i++) {
        result.push(songLines[i]);
      }
      result.push("{end_of_tab}");
    }
    return result.join("\n");
  }

  let chordLineToInsert: string | null = null;
  const structuredSong: string[] = [];

  for (const line of songLines) {
    const dirMatch = isDirectiveLine(line);

    if (isChordLine(line)) {
      if (chordLineToInsert) {
        structuredSong.push(
          formatStandaloneChordLine(chordLineToInsert, convertToCzechNotation),
        );
      }
      chordLineToInsert = line;
    } else if (dirMatch && !isChordLine(line)) {
      if (chordLineToInsert) {
        structuredSong.push(
          formatStandaloneChordLine(chordLineToInsert, convertToCzechNotation),
        );
        chordLineToInsert = null;
      }
      const content = dirMatch[1] !== undefined ? dirMatch[1] : dirMatch[2];
      structuredSong.push(`{comment: ${content}}`);
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
    structuredSong.push(
      formatStandaloneChordLine(chordLineToInsert, convertToCzechNotation),
    );
  }

  return structuredSong.join("\n");
}

function processSong(
  songLines: string[],
  convertToCzechNotation: boolean,
): string {
  const paragraphs = groupLinesIntoParagraphs(songLines);
  const result: string[] = [];
  let pendingEnv: string | null = null;

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) continue;

    let envToApply = pendingEnv;
    pendingEnv = null;
    const linesToProcess = [...paragraph];
    const prependComments: string[] = [];

    // Analyze paragraph headers to assign environments across boundaries
    while (linesToProcess.length > 0) {
      const firstLine = linesToProcess[0];

      // Protect against single-chord lines (like `B`) triggering as bridge directives
      if (isChordLine(firstLine)) break;

      const dir = getEnvironmentDirective(firstLine);
      if (dir) {
        if (linesToProcess.length === 1) {
          if (dir.env) pendingEnv = dir.env;
          else if (dir.comment)
            prependComments.push(`{comment: ${dir.comment}}`);
          linesToProcess.shift();
          break;
        } else {
          if (dir.env) envToApply = dir.env;
          else if (dir.comment)
            prependComments.push(`{comment: ${dir.comment}}`);

          const strippedLine = firstLine.slice(dir.stripLength).trim();
          if (strippedLine.length === 0) {
            linesToProcess.shift();
          } else {
            linesToProcess[0] = strippedLine; // Removes '1. ' but leaves lyric content intact
            break;
          }
        }
      } else {
        break;
      }
    }

    const blockResult: string[] = [];

    if (prependComments.length > 0) {
      blockResult.push(prependComments.join("\n"));
    }

    if (linesToProcess.length > 0) {
      const processedStr = processParagraphLines(
        linesToProcess,
        convertToCzechNotation,
      );
      if (envToApply) {
        // Correctly wraps processed content—even if it contains tabs—within the pending environment
        blockResult.push(
          `{start_of_${envToApply}}\n${processedStr}\n{end_of_${envToApply}}`,
        );
      } else {
        blockResult.push(`{start_of_verse}\n${processedStr}\n{end_of_verse}`);
      }
    }

    if (blockResult.length > 0) {
      result.push(blockResult.join("\n"));
    }
  }

  return result.join("\n\n");
}

export function isConvertibleFormat(text: string): boolean {
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
  return chordLineCount >= 2 && chordLineCount / nonEmptyLineCount >= 0.1;
}

export function convertToChordPro(
  songText: string,
  convertToCzechNotation: boolean = false,
): string {
  const songLines = songText.split("\n");
  return processSong(songLines, convertToCzechNotation);
}
