import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query"; //
import React, { useEffect } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import useLocalStorageState from "use-local-storage-state";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { SongDB } from "~/types/types";
import { handleApiResponse } from "~/services/apiHelpers";
import { SongData } from "~/types/songData";

export const Route = createFileRoute("/feed/$masterId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    return {
      user: context.user,
      songDB: context.songDB,
      masterId: params.masterId,
      api: context.api 
    };
  },
});

function RouteComponent() {
  const { songDB, masterId, user, api } = Route.useLoaderData();

  return <FeedView songDB={songDB} masterId={masterId} user={user} api={api} />;
}

type FeedViewProps = {
  songDB: SongDB;
  masterId: string;
  user: UserProfileData;
  api: any; // Type this properly based on your client definition
};

function FeedView({ songDB, masterId, user, api }: FeedViewProps) {
  // Feed route manages session sync as follower (read-only)
  const { currentSongId, isConnected, currentTransposeSteps } = useSessionSync(
    masterId,
    false, // isMaster = false (follower mode)
    true // enabled
  );

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
        param: { id: currentSongId }
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

  // Handle loading state for fetch-on-miss
  if (currentSongId && !songData) {
     return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading song...</p>
      </div>
    );
  }

  if (!songData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Waiting for {masterId} to select a song...</p>
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