import { createFileRoute } from "@tanstack/react-router";
import SongList from "~/features/SongList/SongList";
import { useSongDB } from "~/hooks/use-songDB";
import { useUserData } from "~/hooks/use-user-data";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { userData } = useUserData();
  const { songDB, isSyncing } = useSongDB(userData);
  return (
    <SongList songDB={songDB} songDBSyncing={isSyncing} userData={userData} />
  );
}
