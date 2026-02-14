import { ExternalSong } from ".";

interface CifraSong {
  t: string; // type? artist=="1"; chords=="2"?
  s: number; // score
  u: string; // song title slug
  d: string; // artist slug
  i: string; // illustration
  a: string; // artist
  m: string; // song title
  b: number; // ?
}

interface CifraResponse {
  numFound: number;
  start: number;
  maxScore: number;
  docs: CifraSong[];
}

export async function searchCifraClub(
  query: string,
): Promise<ExternalSong[]> {
  try {
    const response = await fetch(`https://solr.sscdn.co/cc/h2/?q=${query}`);

    if (!response.ok) return [];

    // Get the text response and strip the JSONP wrapper
    const text = await response.text();
    const jsonText = text.trim().slice(1, -1);
    const data = JSON.parse(jsonText)["response"] as CifraResponse;
    return (data.docs || [])
      .filter((hit) => hit.t === "2")
      .map((hit) => ({
        id: `cifraclub.com/${hit.d}/${hit.u}`,
        title: hit.m,
        artist: hit.a,
        url: `https://www.cifraclub.com/${hit.d}/${hit.u}`,
        thumbnailURL: hit.i
          ? `https://akamai.sscdn.co/letras/115x115/fotos/${hit.i}`
          : "cc_logo.png",
        externalSource: "cifraclub",
      }));
  } catch (error) {
    console.error("Error searching Cifra Club:", error);
    return [];
  }
}
