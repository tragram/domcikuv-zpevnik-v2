import { SONG_SOURCES } from "src/lib/db/schema";
import { z } from "zod";
import { searchCifraClub } from "./cifraclub";
import { searchPisnickyAkordy } from "./pisnicky-akordy";
import { searchZpevnikSkorepova } from "./zpevnik-skorepova";

export const externalSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  url: z.string(),
  sourceId: z.enum(SONG_SOURCES),
  thumbnailURL: z.string().optional(),
});

export type ExternalSearchResult = z.infer<typeof externalSearchResultSchema>;

export async function searchAllExternalServices(
  query: string,
  env: Env,
): Promise<ExternalSearchResult[]> {
  const results = await Promise.all([
    searchPisnickyAkordy(query, env.PA_BEARER_TOKEN),
    searchZpevnikSkorepova(query, env.KV),
    searchCifraClub(query),
  ]);

  return results.flat();
}
