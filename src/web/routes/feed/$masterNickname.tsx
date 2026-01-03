import { createFileRoute } from "@tanstack/react-router";
import React, { useCallback, useEffect } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import useLocalStorageState from "use-local-storage-state";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { SongDB } from "~/types/types";

export const Route = createFileRoute("/feed/$masterNickname")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    return {
      user: context.user,
      songDB: context.songDB,
      masterNickname: params.masterNickname,
    };
  },
});

function RouteComponent() {
  const { songDB, masterNickname, user } = Route.useLoaderData();

  return <FeedView songDB={songDB} masterNickname={masterNickname} user={user} />;
}

type FeedViewProps = {
  songDB: SongDB;
  masterNickname: string;
  user: UserProfileData;
};

function FeedView({ songDB, masterNickname, user }: FeedViewProps) {
  // Feed route manages session sync as follower (read-only)
  const { currentSongId, isConnected, currentTransposeSteps } = useSessionSync(
    masterNickname,
    false, // isMaster = false (follower mode)
    true // enabled
  );

  // useMemo to prevent re-finding the song on every render
  const songData = React.useMemo(() => {
    return currentSongId
      ? songDB.songs.find((s) => s.id === currentSongId)
      : null;
  }, [currentSongId, songDB.songs]);

  // force transposeSteps (a bit hacky but passing it down feels even uglier - TODO: use Zustand)
  const [, setTransposeSteps] = useLocalStorageState(
    `transposeSteps/${currentSongId}`,
    { defaultValue: 0 }
  );

  useEffect(() => {
    if (currentTransposeSteps !== undefined)
      setTransposeSteps(currentTransposeSteps);
  }, [currentTransposeSteps, setTransposeSteps]);

  if (!isConnected && !currentSongId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Connecting to feed...</p>
      </div>
    );
  }

  if (!songData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Waiting for {masterNickname} to select a song...</p>
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
        isConnected,
        isMaster: false,
        connectedClients: 0,
      }}
    />
  );
}
