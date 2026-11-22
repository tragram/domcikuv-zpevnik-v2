import { QueryClient } from "@tanstack/react-query";
import { RouteIds, useLoaderDeps, useParams } from "@tanstack/react-router";
import { publicSongbooksQueryOptions, songsQueryOptions } from "~/hooks/use-songDB";
import type { routeTree } from "~/routeTree.gen";
import { SongData } from "~/types/songData";
import { findOrFetchSong, getCachedSongVersion } from "./song-service";
import { ApiException } from "./api-service";
import {
  favoritesQueryOptions,
  getSessionUserId,
  sessionQueryOptions,
  songbookEntriesQueryOptions,
} from "~/hooks/use-user-data";
import { SongbookOverride } from "~/features/SongView/hooks/songTransposeMath";
import PendingComponent from "~/components/PendingComponent";
import { getIsOnline, useIsOnline } from "~/hooks/use-is-online";
import { selectSongVersion, type VersionSelection } from "src/lib/song-selection";
import type { SongbookEntryApi, SongDataApi } from "src/worker/api/api-types";
import type { Songbook } from "~/types/types";

// Online navigation revalidates the sheet; offline cached sheets open immediately.
export const SongPendingComponent = () => {
  const isOnline = useIsOnline();
  if (!isOnline) return null;
  return (
    <PendingComponent title="Loading Song" text="Fetching the song from the DB..." />
  );
};

type SongLoaderErrorComponentProps = {
  from: RouteIds<typeof routeTree>;
};

export const SongLoaderErrorComponent = ({
  from,
}: SongLoaderErrorComponentProps) => {
  const params = useParams({ from }) as { songId: string };
  const deps = useLoaderDeps({ from }) as { version?: string };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4">
      <div className="gap-4 outline-4 outline-primary p-6 rounded-xl">
        <p className="text-lg text-primary">Song not found</p>
        <p className="text-sm">
          The song with ID "{params.songId}"{" "}
          {deps.version ? `(version ${deps.version})` : ""} could not be found.
        </p>
      </div>
    </div>
  );
};
type SongLoaderDeps = {
  version?: string;
  // Owner userId when the song is opened from someone else's songbook.
  songbook?: string;
};

// Define the loader params type
type SongLoaderParams = {
  songId: string;
};

type SongLoaderContext = {
  queryClient: QueryClient;
};

// Define the loader return type
export type SongLoaderData = {
  songData: SongData;
  songId: string;
  versionId?: string;
  // The songbook owner's saved key/capo, when browsing their songbook.
  personalizationOverride?: SongbookOverride;
  versionSelection: VersionSelection;
};

const songLoader = async ({
  context,
  params,
  deps,
  editing = false,
}: {
  editing?: boolean;
  context: SongLoaderContext;
  params: SongLoaderParams;
  deps: SongLoaderDeps;
}): Promise<SongLoaderData> => {
  const queryClient = context.queryClient;

  const canonicalSongs = queryClient.getQueryData<SongDataApi[]>(songsQueryOptions().queryKey) ?? [];
  const official = canonicalSongs.find((song) => song.id === params.songId);
  const localBrowse = !!official && !editing && !deps.version && !deps.songbook;
  // Personal context can finish syncing in the background during ordinary browsing.
  // ensureQueryData reads restored data immediately, fetching only on a miss.
  if (!localBrowse && !deps.version && !deps.songbook) {
    await queryClient.ensureQueryData(sessionQueryOptions());
  }
  const viewerId = getSessionUserId(queryClient);
  let favorites = viewerId
    ? queryClient.getQueryData<SongbookEntryApi[]>(favoritesQueryOptions(viewerId).queryKey)
    : undefined;
  if (!localBrowse && viewerId && !deps.version && (!deps.songbook || deps.songbook === viewerId)) {
    favorites = await queryClient.ensureQueryData(favoritesQueryOptions(viewerId)).catch(() => favorites);
  }
  const ownEntry = (favorites ?? []).find((entry) => entry.songId === params.songId);
  let songbook: Parameters<typeof selectSongVersion>[0]["songbook"];
  if (deps.songbook && !deps.version) {
    const entries = deps.songbook === viewerId ? favorites
      : await queryClient.ensureQueryData(songbookEntriesQueryOptions(deps.songbook));
    songbook = {
      entry: entries?.find((entry) => entry.songId === params.songId),
      ownerName: queryClient.getQueryData<Songbook[]>(publicSongbooksQueryOptions().queryKey)
        ?.find((book) => book.user === deps.songbook)?.name,
    };
  }
  const selected = selectSongVersion({
    official,
    ownEntry, songbook, versionId: deps.version,
  });
  const pinnedId = selected.pinnedVersionId ?? undefined;
  const candidates = selected.sheet ? [selected.sheet] : [];
  const cachedPin = pinnedId ? getCachedSongVersion(queryClient, params.songId, pinnedId, candidates) : undefined;
  const online = getIsOnline();
  const missingOfflinePin = !online && !!pinnedId && !cachedPin;
  const requestedId = deps.version ?? (missingOfflinePin ? undefined : pinnedId);
  const sheets = missingOfflinePin ? canonicalSongs : candidates;
  let songData: SongData;
  try {
    const downloaded = !editing && !deps.version && !(import.meta.env.DEV && online)
      ? (pinnedId ? (missingOfflinePin ? official : cachedPin) : selected.sheet) : undefined;
    songData = downloaded ? (downloaded instanceof SongData ? downloaded : new SongData(downloaded))
      : await findOrFetchSong(sheets, params.songId, requestedId, queryClient);
  } catch (error) {
    // Saved choices may have been withdrawn since the book was cached. Exact
    // links still fail honestly; personal/book navigation can show official.
    if (deps.version || !pinnedId || !(error instanceof ApiException) || ![403, 404].includes(error.status)) throw error;
    songData = await findOrFetchSong(canonicalSongs, params.songId, undefined, queryClient);
  }
  songData.isFavorite = !!ownEntry;
  const versionSelection: VersionSelection = { source: selected.source };
  if (selected.source === "songbook") versionSelection.ownerName = selected.ownerName;
  if (selected.source === "saved" || selected.source === "songbook") {
    versionSelection.unavailable = !!selected.pinnedVersionId && songData.versionId !== selected.pinnedVersionId;
  }

  return {
    songData,
    songId: params.songId,
    versionId: deps.version,
    personalizationOverride: selected.personalizationOverride,
    versionSelection,
  };
};

export default songLoader;
