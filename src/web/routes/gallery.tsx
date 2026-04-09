import { createFileRoute } from "@tanstack/react-router";
import { useUserData } from "src/web/hooks/use-user-data";
import SongGallery from "~/features/Gallery/SongGallery";
import { useSongDB } from "~/hooks/use-songDB";
export const Route = createFileRoute("/gallery")({
  component: Home,
  loader: async ({ context }) => {
    return context;
  },
  ssr: false,
});

function Home() {
  const { favorites, submissions, userProfile } = useUserData();
  const { songDB } = useSongDB(userProfile, favorites, submissions);

  return <SongGallery songDB={songDB} />;
}
