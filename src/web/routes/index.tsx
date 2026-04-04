import { createFileRoute } from "@tanstack/react-router";
import SongList from "~/features/SongList/SongList";
import { FilterStoreProvider } from "~/features/SongView/hooks/filterSettingsStore";
import { useSongDB } from "~/hooks/use-songDB";
import { useUserProfile } from "~/hooks/use-user-profile";

export const Route = createFileRoute("/")({
  component: Index,
  loader: async ({ context }) => {
    return context;
  },
});

function Index() {
  const { songDB } = useSongDB();
  const { userProfile: user } = useUserProfile();
  return (
    <FilterStoreProvider availableSongbooks={songDB.songbooks}>
      <SongList songDB={songDB} user={user} />
    </FilterStoreProvider>
  );
}
