// Converts song text with chord lines (Ultimate Guitar, pisnicky-akordy.cz...) into ChordPro format

import { convertChordNotation } from "~/features/SongView/utils/chordNotation";

interface Token {
  text: string;
  position: number;
}

interface EnvDirective {
  env: "verse" | "chorus" | "bridge";
  name?: string;
  stripLength: number;
}

// Global Matchers
// Matches chords like G, C#m, Dsus4*, G/B, N.C., Cadd9**
const CHORD_REGEX =
  /^[({\[]?([A-H][#b]?(?:m|mi|maj|min|sus|dim|aug|add|M)?[0-9]*(?:[#b][0-9]+)?(?:\/[A-H][#b]?)?\**|N\.?C\.?)[)}\]]?$/i;

// Allowed non-chord characters on a chord line (bar lines, repeat markers)
const ALLOWED_EXTRAS_REGEX = /^(?:[()|%xX~/\\]+|\d+x)$/;

// Matches tab line indicators
const TAB_LINE_REGEX = /(?:^[a-gA-G]\s*\|)|(?:\|-)|(?:-\|)|(?:--\|)|(?:\|--)/;

function isTabLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 5) return false;
  if (/^[a-gA-G]\s*\|/.test(trimmed)) return true;
  return (
    (trimmed.match(/-/g) || []).length >= 4 && TAB_LINE_REGEX.test(trimmed)
  );
}

function isDirectiveLine(line: string): RegExpMatchArray | null {
  return line.match(/^\s*(?:\[(.*)\]|\((.*)\))\s*$/);
}

function getEnvironmentDirective(line: string): EnvDirective | null {
  // Matches numbered verses: "1. ", "12. "
  const verseMatch = line.match(/^\s*(\d+\.)(?:[\s]+|$)/);
  if (verseMatch) {
    return {
      env: "verse",
      name: verseMatch[1],
      stripLength: verseMatch[0].length,
    };
  }

  // Matches chorus markers: "R", "Ref:", "Chorus 2"
  const chorusMatch = line.match(
    /^\s*(R\d*|Ref\.?|Chorus\s*\d*|Refrain\s*\d*)(?:[\s:]+|$)/i,
  );
  if (chorusMatch) {
    let name: string | undefined = chorusMatch[1].trim();
    if (/^(chorus|refrain)$/i.test(name)) name = undefined;
    return { env: "chorus", name, stripLength: chorusMatch[0].length };
  }

  // Matches bridge markers: "B:", "Bridge"
  const bridgeMatch = line.match(/^\s*(B\d*|Bridge\s*\d*)(?:[\s:]+|$)/i);
  if (bridgeMatch) {
    let name: string | undefined = bridgeMatch[1].trim();
    if (/^bridge$/i.test(name)) name = undefined;
    return { env: "bridge", name, stripLength: bridgeMatch[0].length };
  }

  // Bracketed directives like [Intro], (Verse 2)
  const dirMatch = isDirectiveLine(line);
  if (dirMatch) {
    const content = (dirMatch[1] ?? dirMatch[2]).trim();
    const origMatch = content.match(
      /^(verse|chorus|refrain|bridge)(?:\s+(.*))?$/i,
    );

    if (origMatch) {
      const lowerBase = origMatch[1].toLowerCase();
      const baseEnv =
        lowerBase === "refrain"
          ? "chorus"
          : (lowerBase as "verse" | "chorus" | "bridge");
      return {
        env: baseEnv,
        name: origMatch[2]?.trim(),
        stripLength: line.length,
      };
    }

    // Everything else (Intro, Solo, Outro) safely defaults to a named verse block
    return { env: "verse", name: content, stripLength: line.length };
  }

  return null;
}

function getChordTokens(chordLine: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\S+/g;
  let match;

  while ((match = regex.exec(chordLine)) !== null) {
    const text = match[0];
    const cleanText = text.replace(/[,.]$/, "");
    const chordMatch = CHORD_REGEX.exec(cleanText);

    if (chordMatch) {
      tokens.push({
        text: chordMatch[1], // Capture group 1 has the pure chord string
        position: match.index + text.indexOf(chordMatch[1]),
      });
    }
  }
  return tokens;
}

function isChordLine(line: string): boolean {
  if (/\[[A-H][#bs]?m?[mi]?[5-7]?\]/.test(line)) return false; // Already ChordPro tags
  if (isTabLine(line)) return false;

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;

  for (const token of tokens) {
    const cleanToken = token.replace(/[,.]$/, "");
    if (CHORD_REGEX.test(cleanToken)) {
      chordCount++;
    } else if (!ALLOWED_EXTRAS_REGEX.test(cleanToken)) {
      return false; // Immediately fail if a word is neither a chord nor allowed extra
    }
  }

  return chordCount > 0;
}

function tokenizeWithPositions(text: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    tokens.push({ text: match[0], position: match.index });
  }
  return tokens;
}

function placeChords(lyricToken: Token, chordTokens: Token[]): string {
  let word = lyricToken.text;
  const wordStartPos = lyricToken.position;

  const adjustedChords = chordTokens.map((chord) => {
    const offset = chord.position - wordStartPos;
    // Snap chords close to the start of a short word
    if (
      offset < 2 ||
      (offset === 2 && word.length === 2) ||
      (offset === 3 && word.length === 3)
    ) {
      return { ...chord, position: wordStartPos };
    }
    return chord;
  });

  // Reversing so index injections don't affect each other
  for (const chord of adjustedChords.reverse()) {
    const insertPos = Math.max(0, chord.position - wordStartPos);
    word = `${word.slice(0, insertPos)}[${chord.text}]${word.slice(insertPos)}`;
  }
  return word;
}

export function normalizeChordTokens(
  tokens: Token[],
  convertToCzechNotation: boolean = false,
): Token[] {
  return tokens.map((token) => {
    let text = token.text.replace(/[,.]+$/, ""); // strip trailing punct
    if (convertToCzechNotation) {
      text = convertChordNotation(text);
    }
    return { ...token, text };
  });
}

function insertChordsInLyrics(
  chordLine: string,
  lyricLine: string,
  convert: boolean,
): string {
  const result: string[] = [];
  const lyricTokens = tokenizeWithPositions(lyricLine);
  const chordTokens = normalizeChordTokens(getChordTokens(chordLine), convert);

  let chordIndex = 0;
  for (const lyricToken of lyricTokens) {
    const lyricTokenEnd = lyricToken.position + lyricToken.text.length;
    const chordsToInsert: Token[] = [];

    while (
      chordIndex < chordTokens.length &&
      chordTokens[chordIndex].position < lyricTokenEnd
    ) {
      chordsToInsert.push(chordTokens[chordIndex]);
      chordIndex++;
    }
    result.push(placeChords(lyricToken, chordsToInsert));
  }

  while (chordIndex < chordTokens.length) {
    result.push(`[${chordTokens[chordIndex].text}]`);
    chordIndex++;
  }

  return result.join(" ");
}

function formatStandaloneChordLine(line: string, convert: boolean): string {
  const tokens = getChordTokens(line);
  let result = line;

  for (const token of [...tokens].reverse()) {
    const chordText = convert ? convertChordNotation(token.text) : token.text;
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
  convert: boolean,
): { content: string; isTab: boolean } {
  if (songLines.some(isTabLine)) {
    const result: string[] = [];
    let tabStartIndex = 0;

    while (tabStartIndex < songLines.length) {
      const line = songLines[tabStartIndex];
      const dirMatch = isDirectiveLine(line);

      if (dirMatch && !isChordLine(line)) {
        const content = (dirMatch[1] ?? dirMatch[2]).trim();
        result.push(`{comment: ${content}}`);
        tabStartIndex++;
      } else {
        break;
      }
    }

    if (tabStartIndex < songLines.length) {
      result.push(
        "{start_of_tab}",
        ...songLines.slice(tabStartIndex),
        "{end_of_tab}",
      );
    }
    return { content: result.join("\n"), isTab: true };
  }

  const structuredSong: string[] = [];
  let pendingChordLine: string | null = null;

  // Extracted helper handles writing unmatched chord-only lines easily
  const flushPendingChord = () => {
    if (pendingChordLine) {
      structuredSong.push(formatStandaloneChordLine(pendingChordLine, convert));
      pendingChordLine = null;
    }
  };

  for (const line of songLines) {
    const dirMatch = isDirectiveLine(line);

    if (isChordLine(line)) {
      flushPendingChord();
      pendingChordLine = line;
    } else if (dirMatch && !isChordLine(line)) {
      flushPendingChord();
      const content = (dirMatch[1] ?? dirMatch[2]).trim();
      structuredSong.push(`{comment: ${content}}`);
    } else {
      if (pendingChordLine) {
        structuredSong.push(
          insertChordsInLyrics(pendingChordLine, line, convert),
        );
        pendingChordLine = null;
      } else {
        structuredSong.push(line.trim());
      }
    }
  }
  flushPendingChord();

  return { content: structuredSong.join("\n"), isTab: false };
}

function processSong(songLines: string[], convert: boolean): string {
  const paragraphs = groupLinesIntoParagraphs(songLines);
  const result: string[] = [];
  let pendingEnv: EnvDirective | null = null;

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) continue;

    let explicitEnv = pendingEnv ? { ...pendingEnv } : null;
    pendingEnv = null;
    const linesToProcess = [...paragraph];
    const prependComments: string[] = [];

    while (linesToProcess.length > 0) {
      const firstLine = linesToProcess[0];
      if (isChordLine(firstLine)) break;

      const dir = getEnvironmentDirective(firstLine);
      if (!dir) break;

      const commentFallback =
        explicitEnv?.name ||
        (explicitEnv
          ? explicitEnv.env.charAt(0).toUpperCase() + explicitEnv.env.slice(1)
          : "");

      if (linesToProcess.length === 1) {
        if (explicitEnv) prependComments.push(`{comment: ${commentFallback}}`);
        pendingEnv = dir;
        linesToProcess.shift();
        break;
      } else {
        if (explicitEnv) prependComments.push(`{comment: ${commentFallback}}`);
        explicitEnv = dir;

        const strippedLine = firstLine.slice(dir.stripLength).trim();
        if (strippedLine.length === 0) {
          linesToProcess.shift();
        } else {
          linesToProcess[0] = strippedLine;
          break;
        }
      }
    }

    const blockResult: string[] = [];
    if (prependComments.length > 0) {
      blockResult.push(prependComments.join("\n"));
    }

    if (linesToProcess.length > 0) {
      const processed = processParagraphLines(linesToProcess, convert);

      if (processed.isTab) {
        if (explicitEnv) {
          const c =
            explicitEnv.name ||
            explicitEnv.env.charAt(0).toUpperCase() + explicitEnv.env.slice(1);
          blockResult.push(`{comment: ${c}}`);
        }
        blockResult.push(processed.content);
      } else {
        const finalEnv = explicitEnv || { env: "verse", stripLength: 0 };
        const nameStr = finalEnv.name ? `: ${finalEnv.name}` : "";

        blockResult.push(`{start_of_${finalEnv.env}${nameStr}}`);
        blockResult.push(processed.content);
        blockResult.push(`{end_of_${finalEnv.env}}`);
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
      if (isChordLine(line)) chordLineCount++;
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
