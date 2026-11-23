import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { SongbookEntryApi, SongDataApi } from "src/worker/api/api-types";

export function isSheetQuery(key: QueryKey) {
  return key[0] === "song" && key[1] === "fetch";
}

export function unavailableSheet(error: unknown): error is { status: 403 | 404 } {
  return !!error && typeof error === "object" && "status" in error &&
    (error.status === 403 || error.status === 404);
}

function storesSheets(key: QueryKey) {
  return isSheetQuery(key) || ["songs", "favorites", "songbookEntries"].includes(String(key[0]));
}

// Each source keeps its own membership and freshness timestamp. Only replace a
// sheet when another download of that same version has a higher revision.
export function watchDownloadedRevisions(cache: QueryClient) {
  const queries = cache.getQueryCache();
  function reconcile() {
    const newest = new Map<string, SongDataApi>();
    const sources = queries.findAll({ predicate: q => !!q.state.data && storesSheets(q.queryKey) });
    function sheets(key: QueryKey, data: unknown): SongDataApi[] {
      if (isSheetQuery(key)) return [data as SongDataApi];
      if (key[0] === "songs") return data as SongDataApi[];
      return (data as SongbookEntryApi[]).flatMap(entry => entry.song ? [entry.song] : []);
    }
    for (const q of sources) {
      for (const sheet of sheets(q.queryKey, q.state.data)) {
        if (!sheet.versionId || !sheet.versionRevision) continue;
        if ((newest.get(sheet.versionId)?.versionRevision ?? 0) < sheet.versionRevision)
          newest.set(sheet.versionId, sheet);
      }
    }
    function replacement(sheet: SongDataApi) {
      const next = sheet.versionId && newest.get(sheet.versionId);
      return next && next.id === sheet.id && next.versionRevision! > (sheet.versionRevision ?? 0)
        ? { ...next, publishedVersionIds: sheet.publishedVersionIds ?? next.publishedVersionIds,
          currentIllustration: sheet.currentIllustration,
          officialVersionId: sheet.officialVersionId,
          isOfficial: sheet.isOfficial,
          updateStatus: sheet.updateStatus } : sheet;
    }
    for (const q of sources) {
      const key = q.queryKey;
      const data = q.state.data;
      if (!sheets(key, data).some(sheet => replacement(sheet) !== sheet)) continue;
      const updated = isSheetQuery(key) ? replacement(data as SongDataApi)
        : key[0] === "songs" ? (data as SongDataApi[]).map(replacement)
        : (data as SongbookEntryApi[]).map(entry => entry.song && replacement(entry.song) !== entry.song
          ? { ...entry, song: replacement(entry.song) } : entry);
      q.setState({ data: updated });
    }
  }
  reconcile();
  return queries.subscribe(event => {
    if (event.type === "updated" && event.action.type === "error" && isSheetQuery(event.query.queryKey) &&
        unavailableSheet(event.action.error)) event.query.setState({ data: undefined });
    if (event.type === "updated" && event.action.type === "success" && storesSheets(event.query.queryKey))
      reconcile();
  });
}
