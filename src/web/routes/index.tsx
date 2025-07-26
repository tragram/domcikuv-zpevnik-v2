import { createFileRoute } from "@tanstack/react-router";
import SongList from "~/features/SongList/SongList";
import { FilterStoreProvider } from "~/features/SongView/hooks/filterSettingsStore";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async ({ context }) => {
    return context;
  },
});

function Index() {
  const { songDB, user } = Route.useLoaderData();
  return (
    <FilterStoreProvider availableSongbooks={songDB.songbooks}>
      <SongList songDB={songDB} user={user} />
    </FilterStoreProvider>
  );
}
