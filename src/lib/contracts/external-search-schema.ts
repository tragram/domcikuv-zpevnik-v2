// Shared client/server contract: shape of an external-search result. The
// worker's scrapers produce it; the import page validates router state with it.
import { z } from "zod/mini";
import { SONG_SOURCES } from "./song-sources";

export const externalSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  url: z.string(),
  sourceId: z.enum(SONG_SOURCES),
  thumbnailURL: z.optional(z.string()),
});

export type ExternalSearchResult = z.infer<typeof externalSearchResultSchema>;
