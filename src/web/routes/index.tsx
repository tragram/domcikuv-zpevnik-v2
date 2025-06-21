import { createFileRoute } from "@tanstack/react-router";
import SongList from "~/features/SongList/SongList";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async ({ context }) => {
    return context;
  },
});

function Index() {
  const { songDB, userData } = Route.useLoaderData();
  return <SongList songDB={songDB} userData={userData} />;
}
