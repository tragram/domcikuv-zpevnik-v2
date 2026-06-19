import { useQuery } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { useMemo, useState } from "react";

import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { fetchExternalSearch } from "~/services/song-service";
import type { UserData } from "~/hooks/use-user-data";
import { useQueryStore } from "./Toolbar/SearchBar";

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
  const { showExternal } = useFilterSettingsStore();
  const { api } = useRouteContext({ from: "__root__" });

  const [triggeredQuery, setTriggeredQuery] = useState<string | null>(null);
  const hasTriggeredExternalSearch = query === triggeredQuery;

  // Offer online search only when the local results are poor (no near-exact
  // match) or the query is long enough to be worth a network round-trip.
  const isQueryValidForExternal =
    !!query && (bestLocalScore > 0.05 || query.trim().length >= 7);
  const canSearchExternal = !!userData && showExternal && isQueryValidForExternal;
  const shouldSearchExternal = canSearchExternal && hasTriggeredExternalSearch;

  const { data: rawExternalSongs = [], isFetching: isLoadingExternal } = useQuery({
    queryKey: ["externalSearch", query],
    queryFn: () => fetchExternalSearch(api, query),
    enabled: shouldSearchExternal,
    staleTime: 1000 * 60 * 5,
    structuralSharing: false,
  });

  const externalSongs = useMemo(() => {
    if (rawExternalSongs.length === 0 || !query) {
      return rawExternalSongs;
    }
    // A threshold of 1.0 makes Fuse a pure sorter — it ranks but never drops items.
    const externalFuse = new Fuse(rawExternalSongs, {
      includeScore: true,
      keys: ["title_for_search", "artist_for_search"],
      ignoreLocation: true,
      threshold: 1.0,
    });
    return externalFuse.search(query).map((r) => r.item);
  }, [rawExternalSongs, query]);

  return {
    externalSongs,
    isLoadingExternal,
    triggerExternalSearch: () => setTriggeredQuery(query),
    hasTriggeredExternalSearch,
    canSearchExternal,
  };
}
