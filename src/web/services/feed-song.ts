import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { API } from "src/worker/api-client";
import type { SongDataApi } from "src/worker/api/api-types";
import type { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import { SongData } from "~/types/songData";
import { handleApiResponse } from "./api-service";
import { songQueryKeys } from "./song-query-keys";

export function feedSongQueryOptions(api: API, state?: Pick<SessionSyncState, "songId" | "versionId" | "versionRevision">) {
  const songId = state?.songId;
  const versionId = state?.versionId;
  return queryOptions({
    queryKey: songQueryKeys.feedSheet(songId, versionId, state?.versionRevision),
    enabled: !!songId,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = versionId
        ? await api.songs.fetch[":songId"][":versionId"].$get({ param: { songId: songId!, versionId } })
        : await api.songs.fetch[":id"].$get({ param: { id: songId! } });
      return handleApiResponse<{ data: SongDataApi }>(response);
    },
    select: (data: SongDataApi): SongData => new SongData(data),
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });
}
