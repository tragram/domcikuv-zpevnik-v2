import { createFileRoute } from "@tanstack/react-router";
import Editor from "~/features/Editor/Editor";
export const Route = createFileRoute("/edit/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const songData = songDB.songs.find((s) => (s.id = songId));

    // TODO: show error song
    return {
      user: context.user,
      songDB,
      songData,
    };
  },
});

function RouteComponent() {
  const { user, songDB, songData } = Route.useLoaderData();
  return <Editor songDB={songDB} songData={songData} user={user} />;
}
