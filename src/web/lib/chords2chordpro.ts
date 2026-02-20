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
const CHORD_REGEX =
  /^[({\[]?([A-H][#b]?(?:m|mi|maj|min|sus|dim|aug|add|M)?[0-9]*(?:[#b][0-9]+)?(?:\/[A-H][#b]?)?\**|N\.?C\.?)[)}\]]?$/i;

const ALLOWED_EXTRAS_REGEX = /^(?:[()|%xX~/\\]+|\d+x)$/;

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
      name: undefined, // Standard numbers shouldn't act as specific names
      stripLength: verseMatch[0].length,
    };
  }

  // Matches chorus markers: "R", "Ref:", "Chorus 2"
  const chorusMatch = line.match(
    /^\s*(R\d*|Ref\.?|Chorus\s*\d*|Refrain\s*\d*)(?:[\s:]+|$)/i,
  );
  if (chorusMatch) {
    let name: string | undefined = chorusMatch[1].trim();
    if (/^(chorus|refrain|r|ref\.?)$/i.test(name)) name = undefined; // Drop generic tags
    return { env: "chorus", name, stripLength: chorusMatch[0].length };
  }

  // Matches bridge markers: "B:", "Bridge"
  const bridgeMatch = line.match(/^\s*(B\d*|Bridge\s*\d*)(?:[\s:]+|$)/i);
  if (bridgeMatch) {
    let name: string | undefined = bridgeMatch[1].trim();
    if (/^(bridge|b)$/i.test(name)) name = undefined; // Drop generic tags
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

    // Everything else (Intro, Solo, Outro) defaults to a named verse block
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
    const cleanText = text.replace(/[,.]+$/, "");
    const chordMatch = CHORD_REGEX.exec(cleanText);

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

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;

  for (const token of tokens) {
    const cleanToken = token.replace(/[,.]+$/, "");
    if (CHORD_REGEX.test(cleanToken)) {
      chordCount++;
    } else if (!ALLOWED_EXTRAS_REGEX.test(cleanToken)) {
      return false;
    }
  }

  return chordCount > 0;
}

export function normalizeChordTokens(
  tokens: Token[],
  convertToCzechNotation: boolean = false,
): Token[] {
  return tokens.map((token) => {
    let text = token.text.replace(/[,.]+$/, "");
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
  const chordTokens = normalizeChordTokens(getChordTokens(chordLine), convert);
  let result = lyricLine;
  const appendChords: string[] = [];

  for (const chord of [...chordTokens].reverse()) {
    let pos = chord.position;

    if (pos >= lyricLine.length) {
      appendChords.unshift(`[${chord.text}]`);
      continue;
    }

    while (pos < result.length && result[pos] === " ") {
      pos++;
    }

    if (pos >= result.length) {
      appendChords.unshift(`[${chord.text}]`);
      continue;
    }

    let wordStart = pos;
    while (wordStart > 0 && result[wordStart - 1] !== " " && result[wordStart - 1] !== "]") {
      wordStart--;
    }

    let wordEnd = pos;
    while (wordEnd < result.length && result[wordEnd] !== " " && result[wordEnd] !== "[") {
      wordEnd++;
    }
    const wordLen = wordEnd - wordStart;
    const offset = pos - wordStart;

    if (
      offset > 0 &&
      (offset < 2 || (offset === 2 && wordLen <= 2) || (offset === 3 && wordLen <= 3))
    ) {
      pos = wordStart;
    }

    result = result.slice(0, pos) + `[${chord.text}]` + result.slice(pos);
  }

  if (appendChords.length > 0) {
    result += (result.length > 0 && !result.endsWith(" ") ? " " : "") + appendChords.join(" ");
  }

  return result.replace(/\s+/g, " ").trim();
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

// Safely shifts a chord line left when lyric prefixes (e.g., '1. ') are stripped
function shiftChordLineLeft(chordLine: string, shift: number): string {
  const tokens = getChordTokens(chordLine);
  if (tokens.length === 0) return chordLine;

  let res = "";
  let curPos = 0;
  for (const t of tokens) {
    const newPos = Math.max(0, t.position - shift);
    if (newPos > curPos) {
      res += " ".repeat(newPos - curPos);
      curPos = newPos;
    }
    res += t.text;
    curPos += t.text.length;
  }
  return res;
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
      const dir = getEnvironmentDirective(line);
      const isPrevLineChord = paragraph.length > 0 && isChordLine(paragraph[paragraph.length - 1]);
      
      // Force block splits for structural markers, but ignore inline prefixes attached to chords
      if (dir && !isChordLine(line) && paragraph.length > 0 && !isPrevLineChord) {
        paragraphs.push(paragraph);
        paragraph = [];
      }
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

      if (isChordLine(firstLine)) {
        // Peek ahead to see if the lyrics beneath the chords contain an inline directive
        let lyricIndex = 0;
        while (lyricIndex < linesToProcess.length && isChordLine(linesToProcess[lyricIndex])) {
          lyricIndex++;
        }
        
        if (lyricIndex < linesToProcess.length) {
          const lyricLine = linesToProcess[lyricIndex];
          const dir = getEnvironmentDirective(lyricLine);
          
          if (dir && !isDirectiveLine(lyricLine)) {
            explicitEnv = dir;
            const strippedLine = lyricLine.slice(dir.stripLength).trim();
            if (strippedLine.length === 0) {
              linesToProcess.splice(lyricIndex, 1);
            } else {
              linesToProcess[lyricIndex] = strippedLine;
              // Shift chord lines left to maintain alignment
              for (let i = 0; i < lyricIndex; i++) {
                linesToProcess[i] = shiftChordLineLeft(linesToProcess[i], dir.stripLength);
              }
            }
          }
        }
        break; 
      }

      const dir = getEnvironmentDirective(firstLine);
      if (!dir) break; 

      const commentFallback =
        explicitEnv?.name ||
        (explicitEnv
          ? explicitEnv.env.charAt(0).toUpperCase() + explicitEnv.env.slice(1)
          : "");

      if (isDirectiveLine(firstLine)) {
        if (explicitEnv) prependComments.push(`{comment: ${commentFallback}}`);
        explicitEnv = dir;
        linesToProcess.shift();
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

    if (linesToProcess.length === 0) {
      pendingEnv = explicitEnv;
      if (prependComments.length > 0) result.push(prependComments.join("\n"));
      continue;
    }

    const blockResult: string[] = [];
    if (prependComments.length > 0) {
      blockResult.push(prependComments.join("\n"));
    }

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