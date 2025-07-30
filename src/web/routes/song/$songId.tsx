import { createFileRoute } from "@tanstack/react-router";
import SongView from "~/features/SongView/SongView";

export const Route = createFileRoute("/song/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const songData = songDB.songs.find((s) => s.id === songId);

    // TODO: show error song if not found
    return {
      user: context.user,
      songDB,
      songData,
    };
  },
});

function RouteComponent() {
  const { songDB, songData } = Route.useLoaderData();
  return <SongView songDB={songDB} songData={songData} />;
}
