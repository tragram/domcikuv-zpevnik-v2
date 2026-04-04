import { createFileRoute } from "@tanstack/react-router";
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
  const { songDB } = useSongDB();

  return <SongGallery songDB={songDB} />;
}
