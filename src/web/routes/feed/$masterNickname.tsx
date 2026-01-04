import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import useLocalStorageState from "use-local-storage-state";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { SongDB } from "~/types/types";

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
    };
  },
});

function RouteComponent() {
  const { songDB, liveState, masterNickname, user } = Route.useLoaderData();
  return (
    <FeedView
      songDB={songDB}
      masterNickname={masterNickname}
      liveState={liveState}
      user={user}
    />
  );
}

type FeedViewProps = {
  songDB: SongDB;
  liveState?: SessionSyncState;
  masterNickname: string;
  user: UserProfileData;
};

function FeedView({ songDB, liveState, masterNickname, user }: FeedViewProps) {
  // Feed route manages session sync as follower (read-only)
  const { isConnected, sessionState, retryAttempt } = useSessionSync(
    masterNickname,
    false,
    true,
    liveState // hydrate with the live version
  );

  // useMemo to prevent re-finding the song on every render
  const songData = useMemo(() => {
    return sessionState?.songId
      ? songDB.songs.find((s) => s.id === sessionState.songId)
      : null;
  }, [sessionState?.songId, songDB.songs]);

  // force transposeSteps (a bit hacky but passing it down feels even uglier - TODO: use Zustand)
  const [, setTransposeSteps] = useLocalStorageState(
    `transposeSteps/${sessionState?.songId}`,
    { defaultValue: 0 }
  );

  useEffect(() => {
    if (sessionState && sessionState.transposeSteps != null)
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
