import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import SongView from "~/features/SongView/SongView";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import { useViewSettingsStore } from "~/features/SongView/hooks/viewSettingsStore";

export const Route = createFileRoute("/song/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const songData = songDB.songs.find((s) => s.id === songId);

    return {
      user: context.user,
      songDB,
      songData,
    };
  },
});

function RouteComponent() {
  const { songDB, songData, user } = Route.useLoaderData();
  const { shareSession } = useViewSettingsStore();
  
  const shouldShare = user.loggedIn && shareSession;
  const masterId = user.loggedIn ? user.profile.nickname ?? undefined : undefined;
  
  const { updateSong } = useSessionSync(
    masterId,
    shouldShare, // isMaster
    shouldShare  // enabled
  );

  // push new songs to the server (if enabled)
  useEffect(() => {
    if (shouldShare && updateSong && songData?.id) {
      console.debug("Master updating song to:", songData.id);
      updateSong(songData.id);
    }
  }, [songData?.id, shouldShare, updateSong]);

    // TODO: show error song if not found
  return <SongView songDB={songDB} songData={songData} user={user} />;
}