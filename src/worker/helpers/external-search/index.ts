import type { ExternalSearchResult } from "src/lib/contracts/external-search-schema";
import { searchCifraClub } from "./cifraclub";
import { searchPisnickyAkordy } from "./pisnicky-akordy";
import { searchZpevnikSkorepova } from "./zpevnik-skorepova";

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
