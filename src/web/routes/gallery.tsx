import { createFileRoute } from "@tanstack/react-router";
import SongGallery from "~/features/Gallery/SongGallery";
export const Route = createFileRoute("/gallery")({
  component: Home,
  loader: async ({ context }) => {
    return context;
  },
  ssr: false,
});

function Home() {
  const { userData, songDB } = Route.useLoaderData();

  return <SongGallery songDB={songDB} />;
}
