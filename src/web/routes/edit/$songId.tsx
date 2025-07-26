import { createFileRoute } from "@tanstack/react-router";
import Editor from "~/features/Editor/Editor";
import { fetchSongContent } from "~/services/songs";

export const Route = createFileRoute("/edit/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const songData = songDB.songs.find((s) => (s.id = songId));

    // TODO: show error song if not found
    const songContent = await context.queryClient.fetchQuery({
      queryKey: ["song", songId],
      queryFn: () => fetchSongContent(songData),
      staleTime: "static",
    });

    // TODO: show error song
    return {
      user: context.user,
      songDB,
      songData,
      songContent,
    };
  },
});

function RouteComponent() {
  const { user, songDB, songData, songContent } = Route.useLoaderData();
  return (
    <Editor songDB={songDB} songData={songData} songContent={songContent} />
  );
}
