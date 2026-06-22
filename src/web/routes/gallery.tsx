import { createFileRoute } from "@tanstack/react-router";
import { useUserData } from "src/web/hooks/use-user-data";
import SongGallery from "~/features/Gallery/SongGallery";
import { useSongDB } from "~/hooks/use-songDB";
import { OfflineNotice } from "~/components/OfflineIndicator";
import { useIsOnline } from "~/hooks/use-is-online";
export const Route = createFileRoute("/gallery")({
  component: Home,
  loader: async ({ context }) => {
    return context;
  },
  ssr: false,
});

function Home() {
  const { userData } = useUserData();
  const { songDB } = useSongDB(userData);
  const isOnline = useIsOnline();

  // Online-only: the gallery renders full-resolution illustrations that are only
  // cached after being viewed individually, so offline it would be a mostly-broken
  // grid. Show a clear notice instead.
  if (!isOnline) {
    return (
      <OfflineNotice
        title="Gallery is offline"
        description="The illustration gallery needs an internet connection. Your songs and their cover art are still available offline from the song list."
      />
    );
  }

  if (!songDB.songs.some((s) => s.currentIllustration)) return null;

  return <SongGallery songDB={songDB} />;
}
