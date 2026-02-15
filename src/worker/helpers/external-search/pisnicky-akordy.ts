import { ExternalSong } from ".";

interface PASong {
  id: number;
  name: string;
  slug: string;
  image: string;
  interpreter: {
    id: number;
    name: string;
    image: string;
    slug: string;
  };
  type: string[];
}

interface PAData {
  estimatedTotalhits: number;
  hits: PASong[];
}

export async function searchPisnickyAkordy(
  query: string,
  token: string,
): Promise<ExternalSong[]> {
  try {
    const response = await fetch(
      "https://pisnicky-akordy.cz/meilisearch/indexes/pa_hlavni_index/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ q: query, limit: 10 }),
      },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as PAData;
    return (data.hits || [])
      .filter((hit) => hit.type[0] === "Písnička")
      .map((hit) => ({
        id: `pisnicky-akordy.cz/${hit.id}`,
        title: hit.name,
        artist: hit.interpreter?.name || "Unknown Artist",
        source: "Písničky Akordy",
        url: `https://pisnicky-akordy.cz/${hit.interpreter?.slug}/${hit.slug}`,
        thumbnailURL: hit.image || "pa_logo.png",
        sourceId: "pisnicky-akordy",
      }));
  } catch (error) {
    console.error("Error searching Písničky Akordy:", error);
    return [];
  }
}
