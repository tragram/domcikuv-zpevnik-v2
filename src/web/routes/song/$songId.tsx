import { createFileRoute } from "@tanstack/react-router";
import SongView from "~/features/SongView/SongView";
import { fetchSong } from "~/lib/songs";
import { SongData } from "~/types/songData";
import { songDBFromJSON } from "~/types/types";

export const Route = createFileRoute("/song/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;

    const songData = await context.queryClient.fetchQuery({
      queryKey: ["song", songId],
      queryFn: () => fetchSong(songId, songDB),
      staleTime: "static"
    });

    // TODO: show error song
    return {
      userData: context.userData,
      songDB,
      songData,
    };
  },
});

function RouteComponent() {
  const { userData, songDB, songData } = Route.useLoaderData();
  return <SongView songDB={songDB} songData={songData} />;
}
