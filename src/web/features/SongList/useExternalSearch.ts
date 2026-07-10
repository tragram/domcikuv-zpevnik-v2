import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";

import { fetchExternalSearch } from "~/services/song-service";
import type { UserData } from "~/hooks/use-user-data";
import { useIsOnline } from "~/hooks/use-is-online";
import { SongData } from "~/types/songData";
import type { ExternalSearchResult } from "src/lib/contracts/external-search-schema";
import { useQueryStore } from "./Toolbar/SearchBar";

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
  const { query } = useQueryStore();
  const { api } = useRouteContext({ from: "__root__" });
  const isOnline = useIsOnline();

  const [triggeredQuery, setTriggeredQuery] = useState<string | null>(null);
  const hasTriggeredExternalSearch = query === triggeredQuery;

  // Offer online search only when the local results are poor (no near-exact
  // match) or the query is long enough to be worth a network round-trip.
  const isQueryValidForExternal =
    !!query && (bestLocalScore > 0.05 || query.trim().length >= 7);
  // Online-only: the endpoint hits third-party libraries and importing a result
  // needs the network too, so hide the whole flow offline. The "show external"
  // browse filter only affects which *local* songs are displayed, not whether
  // online search is offered — same as every other browse filter being bypassed
  // while actively searching (see useDisplayedSongs).
  const canSearchExternal =
    isOnline && !!userData && isQueryValidForExternal;
  const shouldSearchExternal = canSearchExternal && hasTriggeredExternalSearch;

  const { data: externalSongData = [], isFetching: isLoadingExternal } = useQuery({
    queryKey: ["externalSearch", query],
    queryFn: () => fetchExternalSearch(api, query),
    select: toSongData,
    enabled: shouldSearchExternal,
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
    isLoadingExternal,
    triggerExternalSearch: () => setTriggeredQuery(query),
    hasTriggeredExternalSearch,
    canSearchExternal,
  };
}
