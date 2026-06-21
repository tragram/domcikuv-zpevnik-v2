import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import SongList from "~/features/SongList/SongList";
import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { useSongDB } from "~/hooks/use-songDB";
import { useUserData } from "~/hooks/use-user-data";

const indexSearchSchema = z.object({
  // Preselect a songbook by its owner's nickname slug, e.g. /?songbook=dominik.
  songbook: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  component: Index,
});

function Index() {
  const { userData } = useUserData();
  const { songDB, isSyncing } = useSongDB(userData);
  const { songbook: songbookSlug } = Route.useSearch();
  const setSelectedSongbook = useFilterSettingsStore(
    (s) => s.setSelectedSongbook,
  );

  // Apply the URL slug once the songbooks are known: resolve nickname -> owner id
  // and preselect that songbook. Unknown/private slugs simply don't resolve and
  // are ignored. Load-only: later toolbar changes don't rewrite the URL.
  useEffect(() => {
    if (!songbookSlug) return;
    const match = songDB.songbooks.find((s) => s.nickname === songbookSlug);
    if (match) setSelectedSongbook(match.user);
  }, [songbookSlug, songDB.songbooks, setSelectedSongbook]);

  return (
    <SongList songDB={songDB} songDBSyncing={isSyncing} userData={userData} />
  );
}
