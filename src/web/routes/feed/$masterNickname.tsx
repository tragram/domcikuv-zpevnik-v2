import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserData, useUserData } from "src/web/hooks/use-user-data";
import { API } from "src/worker/api-client";

import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { handleApiResponse } from "~/services/api-service";
import { fetchFeed } from "~/services/song-service";
import { SongData } from "~/types/songData";

export const Route = createFileRoute("/feed/$masterNickname")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const liveState = await fetchFeed(context.api, params.masterNickname);
    return {
      masterNickname: params.masterNickname,
      liveState,
      api: context.api,
    };
  },
});

function RouteComponent() {
  const { liveState, masterNickname, api } = Route.useLoaderData();

  const { userData } = useUserData();
  return (
    <FeedView
      masterNickname={masterNickname}
      liveState={liveState}
      userData={userData}
      api={api}
    />
  );
}

type FeedViewProps = {
  liveState?: SessionSyncState;
  masterNickname: string;
  userData: UserData;
  api: API;
};

function FeedView({ liveState, masterNickname, userData, api }: FeedViewProps) {
  const { feedStatus } = useSessionSync(masterNickname, false, true, liveState);
  const navigate = useNavigate();

  // change URL if nickname changes
  const currentMasterNickname = feedStatus.sessionState?.masterNickname;
  useEffect(() => {
    if (currentMasterNickname && currentMasterNickname !== masterNickname) {
      navigate({ to: `/feed/${currentMasterNickname}`, replace: true });
    }
  }, [currentMasterNickname, masterNickname, navigate]);

  const currentSongId = feedStatus.sessionState?.songId;
  const currentVersionId = feedStatus.sessionState?.versionId;
  const { data: songData } = useQuery({
    queryKey: ["song", currentSongId, currentVersionId],
    enabled: !!currentSongId,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = currentVersionId
        ? await api.songs.fetch[":songId"][":versionId"].$get({
            param: { songId: currentSongId!, versionId: currentVersionId },
          })
        : await api.songs.fetch[":id"].$get({
            param: { id: currentSongId! },
          });

      const data = await handleApiResponse(response);
      return data;
    },
    select: (data: any) => {
      return data instanceof SongData ? data : new SongData(data);
    },
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });

  if (!feedStatus.sessionState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg">Connecting to feed...</p>
          {!feedStatus.isConnected && feedStatus.retryAttempt > 2 && (
            <p className="text-xs text-gray-400">
              Having trouble connecting but I'll keep trying in the background.
              ;-)
            </p>
          )}
        </div>
      </div>
    );
  }
  if (!songData || !feedStatus.sessionState.songId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg">
            Waiting for {masterNickname} to select a song...
          </p>
          {!feedStatus.isConnected && (
            <p className="text-sm text-yellow-600">
              Connection lost - attempting to reconnect...
            </p>
          )}
        </div>
      </div>
    );
  }
  return (
    <SongView songData={songData} userData={userData} feedStatus={feedStatus} />
  );
}
