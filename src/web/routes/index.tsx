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
  const { songDB, userData, availableSongbooks } = Route.useLoaderData();
  return (
    <FilterStoreProvider availableSongbooks={availableSongbooks}>
      <SongList
        songDB={songDB}
        userData={userData}
        availableSongbooks={availableSongbooks}
      />
    </FilterStoreProvider>
  );
}
