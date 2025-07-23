import { createFileRoute } from "@tanstack/react-router";
import Editor from "~/features/Editor/Editor";
import { fetchSong } from "~/services/songs";
import { SongData } from "~/types/songData";
import { songDBFromJSON } from "~/types/types";

export const Route = createFileRoute("/edit/$songId")({
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
  return <Editor songDB={songDB} songData={songData} />;
}
