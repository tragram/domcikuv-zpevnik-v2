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
  const paResults = await searchPisnickyAkordy(query, env.PA_BEARER_TOKEN);
  const zsResults = await searchZpevnikSkorepova(query, env.KV);
  const ccResults = await searchCifraClub(query);

  return [...paResults, ...zsResults, ...ccResults];
}
