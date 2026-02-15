import { SONG_SOURCES } from "src/lib/db/schema";
import { z } from "zod";
import { searchCifraClub } from "./cifraclub";
import { searchPisnickyAkordy } from "./pisnicky-akordy";

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
  paToken: string,
): Promise<ExternalSearchResult[]> {
  const paResults = await searchPisnickyAkordy(query, paToken);
  const ccResults = await searchCifraClub(query);

  return [...paResults, ...ccResults];
}