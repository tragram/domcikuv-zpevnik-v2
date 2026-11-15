import { QueryClient } from "@tanstack/react-query";
import { RouteIds, useLoaderDeps, useParams } from "@tanstack/react-router";
import { getSongDB, songsQueryOptions } from "~/hooks/use-songDB";
import type { routeTree } from "~/routeTree.gen";
import { SongData } from "~/types/songData";
import { findOrFetchSong } from "./song-service";
import {
  favoritesQueryOptions,
  getSessionUserId,
  songbookEntriesQueryOptions,
} from "~/hooks/use-user-data";
import { SongbookOverride } from "~/features/SongView/hooks/songTransposeMath";
import PendingComponent from "~/components/PendingComponent";
import { useIsOnline } from "~/hooks/use-is-online";
import type { VersionSelection } from "~/features/SongView/utils/versionDetails";
import type { SongbookEntryApi, SongDataApi } from "src/worker/api/api-types";

// The song loader resolves cached songs locally but still awaits `getSongDB`'s
// network-bound refetch attempts, which only fail slowly while offline — long
// enough to trip the route's pending screen. Offline there is nothing to fetch,
// so the "Fetching the song from the DB…" screen is both wrong and pointless;
// suppress it and let the cached song render straight away.
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
}: {
  context: SongLoaderContext;
  params: SongLoaderParams;
  deps: SongLoaderDeps;
}): Promise<SongLoaderData> => {
  const queryClient = context.queryClient;

  const songDB = await getSongDB(queryClient);

  let personalizationOverride: SongLoaderData["personalizationOverride"];
  let songbookOwnerName: string | undefined;
  let songData: SongData | null = null;
  let pinnedVersionId: string | null = null;
  const canonicalSongs =
    queryClient.getQueryData<SongDataApi[]>(songsQueryOptions().queryKey) ?? [];

  // When opened inside another user's songbook, adopt that owner's saved
  // key/capo and (for a pinned draft) their already-resolved song. The query
  // ships only non-canonical drafts inline; canonical entries resolve from the
  // global list below. An explicit ?version still wins (handled below).
  if (deps.songbook && !deps.version) {
    const entries = await queryClient.ensureQueryData(
      songbookEntriesQueryOptions(deps.songbook),
    );
    const entry = entries.find((e) => e.songId === params.songId);
    if (entry) {
      personalizationOverride = { keyIndex: entry.keyIndex, capo: entry.capo };
      songbookOwnerName = songDB.songbooks.find(
        (s) => s.user === deps.songbook,
      )?.name;
      pinnedVersionId = entry.pinnedVersionId;
      if (entry.song) songData = new SongData(entry.song);
    }
  }

  // The viewer's own pinned drafts are already injected into songDB.songs by
  // buildSongDB, so a normal open just resolves from there (fetching an explicit
  // ?version, or on a cache miss). Foreign songbooks resolve from the raw
  // canonical list so the viewer's personal pin cannot replace the owner's song.
  if (!songData) {
    songData = await findOrFetchSong(
      deps.songbook ? canonicalSongs : songDB.songs,
      params.songId,
      deps.version,
      queryClient,
    );
  }
  if (!songData) throw new Error("Song not found!");

  // If the owner pinned a version we couldn't show (deleted, or just not the
  // current one and not shipped), we fell back to the official current version.
  const versionUnavailable =
    pinnedVersionId != null && songData.versionId !== pinnedVersionId;

  const ownEntry = queryClient
    .getQueryData<SongbookEntryApi[]>(
      favoritesQueryOptions(getSessionUserId(queryClient)).queryKey,
    )
    ?.find((entry) => entry.songId === params.songId);
  const versionSelection: VersionSelection = deps.version
    ? { source: "link" }
    : deps.songbook
      ? {
          source: "songbook",
          ownerName: songbookOwnerName,
          unavailable: versionUnavailable,
        }
      : ownEntry?.pinnedVersionId
        ? {
            source: "saved",
            unavailable: songData.versionId !== ownEntry.pinnedVersionId,
          }
        : { source: "official" };

  return {
    songData,
    songId: params.songId,
    versionId: deps.version,
    personalizationOverride,
    versionSelection,
  };
};

export default songLoader;
