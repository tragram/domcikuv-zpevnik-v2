import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import SongView from "~/features/SongView/SongView";
import { SongDB } from "~/types/types";

export const Route = createFileRoute("/feed/$masterId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    return {
      user: context.user,
      songDB: context.songDB,
      masterId: params.masterId,
    };
  },
});

function RouteComponent() {
  const { songDB, masterId, user } = Route.useLoaderData();

  return <FeedView songDB={songDB} masterId={masterId} user={user} />;
}

type FeedViewProps = {
  songDB: SongDB;
  masterId: string;
  user: UserProfileData;
};

function FeedView({ songDB, masterId, user }: FeedViewProps) {
  // Feed route manages session sync as follower (read-only)
  const { currentSongId, isConnected } = useSessionSync(
    masterId,
    false, // isMaster = false (follower mode)
    true // enabled
  );

  // useMemo to prevent re-finding the song on every render
  const songData = React.useMemo(() => {
    return currentSongId ? songDB.songs.find((s) => s.id === currentSongId) : null;
  }, [currentSongId, songDB.songs]);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Connecting to feed...</p>
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

  return <SongView songDB={songDB} songData={songData} user={user} />;
}
