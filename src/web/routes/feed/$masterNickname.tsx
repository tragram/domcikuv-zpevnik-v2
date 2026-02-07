import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query"; //
import React, { useEffect } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import useLocalStorageState from "use-local-storage-state";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { SongDB } from "~/types/types";
import { handleApiResponse } from "~/services/api-service";
import { SongData } from "~/types/songData";
import { API } from "src/worker/api-client";

export const Route = createFileRoute("/feed/$masterNickname")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    let liveState: SessionSyncState | undefined;
    const response = await context.api.session[":masterNickname"].$get({
      param: { masterNickname: params.masterNickname },
    });
    if (response.ok) liveState = (await response.json()) as SessionSyncState;
    return {
      user: context.user,
      songDB: context.songDB,
      masterNickname: params.masterNickname,
      liveState,
      api: context.api,
    };
  },
});

function RouteComponent() {
  const { songDB, liveState, masterNickname, user, api } =
    Route.useLoaderData();

  return (
    <FeedView
      songDB={songDB}
      masterNickname={masterNickname}
      liveState={liveState}
      user={user}
      api={api}
    />
  );
}

type FeedViewProps = {
  songDB: SongDB;
  liveState?: SessionSyncState;
  masterNickname: string;
  user: UserProfileData;
  api: API;
};

function FeedView({
  songDB,
  liveState,
  masterNickname,
  user,
  api,
}: FeedViewProps) {
  // Feed route manages session sync as follower (read-only)
  const { isConnected, sessionState, retryAttempt } = useSessionSync(
    masterNickname,
    false,
    true,
    liveState, // hydrate with the live version
  );
  const currentSongId = sessionState?.songId;
  // try local DB
  const localSong = React.useMemo(() => {
    return currentSongId
      ? songDB.songs.find((s) => s.id === currentSongId)
      : null;
  }, [currentSongId, songDB.songs]);

  // 2. If local miss, try fetching from API
  const { data: fetchedSong } = useQuery({
    queryKey: ["song", currentSongId],
    queryFn: async () => {
      if (!currentSongId || localSong) return null;

      const response = await api.songs.fetch[":id"].$get({
        param: { id: currentSongId },
      });
      const data = await handleApiResponse(response);
      return new SongData(data);
    },
    enabled: !!currentSongId && !localSong,
    staleTime: Infinity, // Once fetched, keep it
  });

  // combine results
  const songData = localSong || fetchedSong;

  // force transposeSteps (a bit hacky but passing it down feels even uglier - TODO: use Zustand)
  const [, setTransposeSteps] = useLocalStorageState(
    `transposeSteps/${currentSongId}`,
    { defaultValue: 0 },
  );

  useEffect(() => {
    if (sessionState && sessionState.transposeSteps !== null)
      setTransposeSteps(sessionState.transposeSteps);
  }, [sessionState, setTransposeSteps]);

  if (!sessionState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg">Connecting to feed...</p>
          {!isConnected && retryAttempt > 2 && (
            <p className="text-xs text-gray-400">
              Having trouble connecting but I'll keep trying in the background.
              ;-)
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!songData || !sessionState.songId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg">
            Waiting for {masterNickname} to select a song...
          </p>
          {!isConnected && (
            <p className="text-sm text-yellow-600">
              Connection lost - attempting to reconnect...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <SongView
      songDB={songDB}
      songData={songData}
      user={user}
      feedStatus={{
        enabled: true,
        sessionState: sessionState,
        isConnected,
        isMaster: false,
        connectedClients: 0,
      }}
    />
  );
}
