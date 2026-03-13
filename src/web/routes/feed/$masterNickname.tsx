import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { API } from "src/worker/api-client";
import { UserProfileData } from "src/worker/api/userProfile";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { handleApiResponse } from "~/services/api-service";
import { fetchFeed } from "~/services/song-service";
import { SongData } from "~/types/songData";
import { SongDB } from "~/types/types";

export const Route = createFileRoute("/feed/$masterNickname")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const liveState = await fetchFeed(context.api, params.masterNickname);
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
  const { feedStatus } = useSessionSync(
    masterNickname,
    false,
    true,
    liveState, // hydrate with the live version
  );

  const currentSongId = feedStatus.sessionState?.songId;
  const { data: songData } = useQuery({
    queryKey: ["song", currentSongId],
    queryFn: async () => {
      if (!currentSongId) return null;

      const response = await api.songs.fetch[":id"].$get({
        param: { id: currentSongId },
      });
      const data = await handleApiResponse(response);
      return new SongData(data);
    },
    staleTime: Infinity,
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
    <SongView
      songDB={songDB}
      songData={songData}
      user={user}
      favoritesApi={api.favorites}
      feedStatus={feedStatus}
    />
  );
}
