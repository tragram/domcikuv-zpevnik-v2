import type { QueryClient } from "@tanstack/react-query";
import client from "src/worker/api-client";
import { makeApiRequest } from "./api-service";
import { songQueryKeys, versionRefreshKeys } from "./song-query-keys";
import { getSessionUserId } from "~/hooks/use-user-data";

export type VersionMutationInput = { songId: string; versionId: string; expectedRevision: number };

export async function refreshSongVersions(cache: QueryClient, songId: string) {
  const viewerId = getSessionUserId(cache);
  await Promise.all(
    versionRefreshKeys(songId).map(queryKey => {
      const personal = queryKey === songQueryKeys.favorites || queryKey === songQueryKeys.submissions;
      if (personal && !viewerId) return;
      return cache.invalidateQueries({
        queryKey: personal ? [...queryKey, viewerId] : queryKey,
        refetchType: queryKey.length > 1 || queryKey === songQueryKeys.songbooks ? "active" : "all",
        predicate: query => !!(query.options.queryFn ?? cache.getQueryDefaults(query.queryKey).queryFn),
      });
    }),
  );
}

export function versionAction(
  songId: string,
  versionId: string,
  action: "official" | "archive" | "restore" | "publish",
  expectedRevision: number,
) {
  return makeApiRequest(() =>
    client.api.editor[":songId"].versions[":versionId"][":action"].$post({
      param: { songId, versionId, action },
      json: { expectedRevision },
    }),
  );
}

export function revisionsQueryOptions(
  songId: string,
  versionId: string,
  viewerId: string,
  offset: number,
) {
  return {
    queryKey: songQueryKeys.revisionPage(songId, versionId, viewerId, offset),
    staleTime: 0,
    queryFn: () =>
      makeApiRequest(() =>
        client.api.editor[":songId"].versions[":versionId"].revisions.$get({
          param: { songId, versionId },
          query: { offset: String(offset) },
        }),
      ),
  };
}

export function restoreSongRevision(
  songId: string,
  versionId: string,
  number: number,
  expectedRevision: number,
) {
  return makeApiRequest(() =>
    client.api.editor[":songId"].versions[":versionId"].revisions[
      ":number"
    ].restore.$post({
      param: { songId, versionId, number: String(number) },
      json: { expectedRevision },
    }),
  );
}
