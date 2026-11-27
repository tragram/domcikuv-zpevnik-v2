import type { ExternalSearchResult } from "src/lib/contracts/external-search-schema";

type KytaryAutocomplete = Record<string, string>;

const BASE_URL = "https://akordy.kytary.cz";
const SONG_PREFIX = "~song~";
const SEPARATOR = " — ";

export async function searchAkordyKytary(
  query: string,
): Promise<ExternalSearchResult[]> {
  try {
    const response = await fetch(
      `${BASE_URL}/public/author-autocomplete?typedText=${encodeURIComponent(query)}`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      console.error(`Akordy Kytary search failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as KytaryAutocomplete;

    return Object.entries(data)
      .filter(
        ([path, label]) =>
          path.startsWith("/song/") && label.startsWith(SONG_PREFIX),
      )
      .map(([path, label]): ExternalSearchResult => {
        const text = label.slice(SONG_PREFIX.length);
        // Split on the last separator in case the title itself contains " — "
        const idx = text.lastIndexOf(SEPARATOR);

        return {
          id: `akordy.kytary.cz${path}`,
          title: idx === -1 ? text : text.slice(0, idx),
          artist: idx === -1 ? "Unknown Artist" : text.slice(idx + SEPARATOR.length),
          url: `${BASE_URL}${path}`,
          sourceId: "akordy-kytary",
        };
      });
  } catch (error) {
    console.error("Error searching Akordy Kytary:", error);
    return [];
  }
}

const KNOWN_ENVS = new Set(["verse", "chorus", "bridge", "interlude"]);

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function wrapSection(type: string, body: string): string {
  const known = KNOWN_ENVS.has(type);
  const env = known ? type : "verse";
  // Unknown section types (intro, outro, ...) become a named verse, like chords2chordpro does
  const name = known ? "" : `: ${type.charAt(0).toUpperCase()}${type.slice(1)}`;
  return `{start_of_${env}${name}}\n${body}\n{end_of_${env}}`;
}

/**
 * Registers handlers on `rewriter` that turn the Kytary chord sheet into
 * ChordPro. Call the returned function after the rewriter has consumed the
 * response to get the result.
 */
export function attachKytaryParser(rewriter: HTMLRewriter): () => string {
  const blocks: string[] = [];
  let sectionLines: string[] = [];
  let line = "";
  let chord = "";
  let inChord = false;

  rewriter
    .on("#snippet--sheetContent .scs-section", {
      element(el) {
        const type = el.getAttribute("data-type") ?? "verse";
        sectionLines = [];
        el.onEndTag(() => {
          if (sectionLines.length > 0) {
            blocks.push(wrapSection(type, sectionLines.join("\n")));
          }
        });
      },
    })
    .on("#snippet--sheetContent .scs-section > div", {
      element(el) {
        line = "";
        el.onEndTag(() => {
          const clean = decodeEntities(line).replace(/\s+/g, " ").trim();
          if (clean) sectionLines.push(clean);
        });
      },
      text(t) {
        // Chord label text is collected separately below
        if (!inChord) line += t.text;
      },
    })
    .on("#snippet--sheetContent .scs-chord", {
      element(el) {
        inChord = true;
        chord = "";
        el.onEndTag(() => {
          inChord = false;
          const name = chord.trim();
          if (name) line += `[${name}]`;
        });
      },
    })
    // root (.scs-chk) + suffix (.scs-chv): "A" + "m" -> Am
    .on(".scs-chord .scs-chk, .scs-chord .scs-chv", {
      text(t) {
        chord += t.text;
      },
    });

  return () => blocks.join("\n\n");
}