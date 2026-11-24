import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { useMemo } from "react";

import { fetchExternalSearch } from "~/services/song-service";
import type { UserData } from "~/hooks/use-user-data";
import { useIsOnline } from "~/hooks/use-is-online";
import { SongData } from "~/types/songData";
import type { ExternalSearchResult } from "src/lib/contracts/external-search-schema";
import { useQueryStore } from "./searchStore";

// Stable identity so react-query only re-runs the select when the data changes.
// The cache keeps the raw API rows; SongData is built on read because a class
// instance persisted to the offline snapshot would rehydrate without its methods.
const toSongData = (rows: ExternalSearchResult[]) =>
  rows.map(SongData.fromExternalSearch);

/**
 * Online ("external") search against third-party song libraries. Kept separate
 * from the local list: it only runs after the user explicitly triggers it, and
 * the backend endpoint requires authentication (see worker/api/external.ts).
 *
 * @param bestLocalScore best local fuzzy match from useDisplayedSongs — online
 *   search is only offered when local results are weak.
 */
export function useExternalSearch(userData: UserData, bestLocalScore: number) {
  const { query, externalSearchTriggered, triggerExternalSearch } = useQueryStore();
  const isOnline = useIsOnline();

  // Offer online search only when the local results are poor (no near-exact
  // match) or the query is long enough to be worth a network round-trip. Keep
  // an active search visible if the import itself creates a close local match.
  const isQueryValidForExternal =
    !!query &&
    (externalSearchTriggered || bestLocalScore > 0.05 || query.trim().length >= 7);
  // Online-only: the endpoint hits third-party libraries and importing a result
  // needs the network too, so hide the whole flow offline.
  const canSearchExternal =
    isOnline && !!userData && isQueryValidForExternal;
  const hasTriggeredExternalSearch = canSearchExternal && externalSearchTriggered;

  const { data: externalSongData = [], isFetching: isLoadingExternal } = useQuery({
    queryKey: ["externalSearch", query],
    queryFn: () => fetchExternalSearch(query),
    select: toSongData,
    enabled: hasTriggeredExternalSearch,
    staleTime: 1000 * 60 * 5,
  });

  const externalSongs = useMemo(() => {
    if (externalSongData.length === 0 || !query) {
      return externalSongData;
    }
    // A threshold of 1.0 makes Fuse a pure sorter — it ranks but never drops items.
    const externalFuse = new Fuse(externalSongData, {
      includeScore: true,
      keys: ["title_for_search", "artist_for_search"],
      ignoreLocation: true,
      threshold: 1.0,
    });
    return externalFuse.search(query).map((r) => r.item);
  }, [externalSongData, query]);

  return {
    externalSongs,
    isLoadingExternal: hasTriggeredExternalSearch && isLoadingExternal,
    triggerExternalSearch,
    hasTriggeredExternalSearch,
    canSearchExternal,
  };
}
