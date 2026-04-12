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
  const { userData } = useUserData();
  const { songDB, isSyncing } = useSongDB(userData);
  return (
    <FilterStoreProvider availableSongbooks={songDB.songbooks}>
      <SongList songDB={songDB} songDBSyncing={isSyncing} userData={userData} />
    </FilterStoreProvider>
  );
}
