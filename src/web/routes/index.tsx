import { createFileRoute } from "@tanstack/react-router";
import SongList from "~/features/SongList/SongList";
import { FilterStoreProvider } from "~/features/SongView/hooks/filterSettingsStore";
import { useSongDB } from "~/hooks/use-songDB";
import { useUserData } from "src/web/hooks/use-user-data";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async ({ context }) => {
    return context;
  },
});

function Index() {
  const { favorites, submissions, userProfile: user } = useUserData();
  const { songDB, isSyncing } = useSongDB(user, favorites, submissions);
  return (
    <FilterStoreProvider availableSongbooks={songDB.songbooks}>
      <SongList songDB={songDB} songDBSyncing={isSyncing} user={user} />
    </FilterStoreProvider>
  );
}
