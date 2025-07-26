import { createFileRoute } from "@tanstack/react-router";
import SongView from "~/features/SongView/SongView";
import { fetchSongContent } from "~/services/songs";

export const Route = createFileRoute("/song/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const songData = songDB.songs.find((s) => s.id === songId);

    // TODO: show error song if not found
    const songContent = await context.queryClient.fetchQuery({
      queryKey: ["song", songId],
      queryFn: () => fetchSongContent(songData),
      staleTime: "static",
    });

    return {
      user: context.user,
      songDB,
      songData,
      songContent,
    };
  },
});

function RouteComponent() {
  const { songDB, songData, songContent } = Route.useLoaderData();
  return (
    <SongView songDB={songDB} songData={songData} songContent={songContent} />
  );
}
