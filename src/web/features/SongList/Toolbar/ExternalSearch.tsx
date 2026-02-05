import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { makeApiRequest } from "~/services/apiHelpers";

export interface ExternalSongResult {
  id: string;
  title: string;
  artist: string;
  source: string;
  url: string;
  thumbnailUrl: string;
  sourceId: string;
}

// Interface for any external search provider
export interface ExternalSearchProvider {
  name: string;
  search(query: string, token: string): Promise<ExternalSongResult[]>;
}

// --- Písničky Akordy Implementation ---
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

export function usePAToken(enabled: boolean = false) {
  const { api } = useRouteContext({ from: "__root__" });

  return useQuery({
    queryKey: ["PAToken"],
    queryFn: () => makeApiRequest(api.songs.info.pa_token.$get),
    staleTime: 1000 * 60 * 60 * 24, // one day
    gcTime: 1000 * 60 * 60 * 24, // keep in cache for one day
    enabled, // only fetch when explicitly enabled
  });
}

export class PisnickyAkordyProvider implements ExternalSearchProvider {
  name = "Písničky Akordy";

  async search(query: string, token: string): Promise<ExternalSongResult[]> {
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

      if (!response.ok) throw new Error("PA Search failed");

      const data = (await response.json()) as PAData;
      return (data.hits || [])
        .filter((hit) => hit.type[0] === "Písnička")
        .map((hit) => ({
          id: `pisnicky-akordy.cz/${hit.id}`,
          title: hit.name,
          artist: hit.interpreter?.name,
          source: this.name,
          url: `/pa/${hit.interpreter.slug}/${hit.slug}`,
          thumbnailUrl: hit.image || "pa_logo.png",
          sourceId: "pisnicky-akordy"
        }));
    } catch (error) {
      console.error("Error searching pisnicky-akordy:", error);
      return [];
    }
  }
}

// --- Registry / Aggregator ---
const providers: ExternalSearchProvider[] = [
  new PisnickyAkordyProvider(),
  // TODO: more sources
];

export async function searchAllExternalServices(
  query: string,
  token: string,
): Promise<ExternalSongResult[]> {
  const promises = providers.map((p) => p.search(query, token));
  const results = await Promise.all(promises);
  return results.flat();
}
