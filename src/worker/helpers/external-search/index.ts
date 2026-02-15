import { SONG_SOURCES } from "src/lib/db/schema";
import { z } from "zod";
import { searchCifraClub } from "./cifraclub";
import { searchPisnickyAkordy } from "./pisnicky-akordy";

export const externalSongSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  url: z.string(),
  externalSource: z.enum(SONG_SOURCES),
  thumbnailURL: z.string().optional(),
});

export type ExternalSong = z.infer<typeof externalSongSchema>;

export async function searchAllExternalServices(
  query: string,
  paToken: string,
): Promise<ExternalSong[]> {
  const paResults = await searchPisnickyAkordy(query, paToken);
  const ccResults = await searchCifraClub(query);

  return [...paResults, ...ccResults];
}
