import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import SongList from "~/features/SongList/SongList";
import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { publicSongbooksQueryOptions, useSongDB } from "~/hooks/use-songDB";
import {
  songbookEntriesQueryOptions,
  useUserData,
} from "~/hooks/use-user-data";
import { useIsOnline } from "~/hooks/use-is-online";

const indexSearchSchema = z.object({
  // Preselect a songbook by its owner's nickname slug, e.g. /?songbook=dominik.
  songbook: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: indexSearchSchema,
  // Arriving via a shared songbook link (/?songbook=<nickname>): resolve the slug
  // to its owner and warm + persist that songbook's entries right away, so it's
  // available offline on the next launch (canonical songs are already prefetched
  // in __root). Fire-and-forget — never block the song list on it.
  beforeLoad: async ({ context, search }) => {
    if (!search.songbook) return;
    const songbooks = await context.queryClient
      .ensureQueryData(publicSongbooksQueryOptions())
      .catch(() => undefined);
    const ownerId = songbooks?.find((s) => s.nickname === search.songbook)?.user;
    const self = context.queryClient.getQueryData<{ user?: { id?: string } }>([
      "session",
    ])?.user?.id;
    if (ownerId && ownerId !== self) {
      context.queryClient.prefetchQuery(songbookEntriesQueryOptions(ownerId));
    }
  },
  component: Index,
});

function Index() {
  const { userData } = useUserData();
  const { songDB, isSyncing, songbooksFetched } = useSongDB(userData);
  const isOnline = useIsOnline();
  const { songbook: songbookSlug } = Route.useSearch();
  const setSelectedSongbook = useFilterSettingsStore(
    (s) => s.setSelectedSongbook,
  );
  // Track which slug we've already resolved, so the effect acts once per slug
  // (and the "not found" toast fires only once, not on every re-render).
  const appliedSlug = useRef<string | null>(null);

  // Apply the URL slug once the songbook list has settled: resolve nickname ->
  // owner id and preselect that songbook. Load-only: later toolbar changes don't
  // rewrite the URL. Gate on `songbooksFetched` (the songbooks query, not the
  // unrelated songs `isSyncing`) so a mid-load empty list never triggers a false
  // "not found", and offline distinguish "can't reach it" from "doesn't exist".
  useEffect(() => {
    if (
      !songbookSlug ||
      !songbooksFetched ||
      appliedSlug.current === songbookSlug
    ) {
      return;
    }
    const match = songDB.songbooks.find((s) => s.nickname === songbookSlug);
    appliedSlug.current = songbookSlug;
    if (match) {
      setSelectedSongbook(match.user);
    } else if (isOnline) {
      toast.error(`Songbook "${songbookSlug}" not found.`);
    } else {
      toast.error(`Songbook "${songbookSlug}" isn't available offline.`);
    }
  }, [
    songbookSlug,
    songbooksFetched,
    songDB.songbooks,
    setSelectedSongbook,
    isOnline,
  ]);

  return (
    <SongList songDB={songDB} songDBSyncing={isSyncing} userData={userData} />
  );
}
