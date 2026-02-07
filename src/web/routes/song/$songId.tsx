import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import useLocalStorageState from "use-local-storage-state";
import SongView from "~/features/SongView/SongView";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import { useViewSettingsStore } from "~/features/SongView/hooks/viewSettingsStore";
import { makeApiRequest } from "~/services/apiHelpers";
import { SongData } from "~/types/songData";
import { z } from "zod";

const songSearchSchema = z.object({
  version: z.string().optional(),
});

export const Route = createFileRoute("/song/$songId")({
  validateSearch: songSearchSchema,
  component: RouteComponent,
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: async ({ context, params, deps }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const versionId = deps.version;

    // If versionId is present, fetch that specific version from API
    if (versionId) {
      const songData = await makeApiRequest(() =>
        context.api.songs.fetch[":songId"][":versionId"].$get({
          param: { songId, versionId },
        }),
      );

      return {
        user: context.user,
        songDB,
        songData: new SongData(songData),
        songId,
        versionId,
        api: context.api,
      };
    }

    // Otherwise, try to find in local songDB (for regular song view)
    const songData = songDB.songs.find((s) => s.id === songId);

    return {
      user: context.user,
      songDB,
      songData,
      songId,
      versionId: null,
      api: context.api,
    };
  },
});

function RouteComponent() {
  const {
    songDB,
    songData: localSongData,
    user,
    songId,
    versionId,
    api,
  } = Route.useLoaderData();
  const { shareSession } = useViewSettingsStore();

  // Only fetch from API if:
  // - No versionId (versioned songs are already fetched in loader)
  // - Not found locally
  const {
    data: fetchedSong,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["song", songId],
    queryFn: async () => {
      if (!songId || localSongData || versionId) return null;

      try {
        const data = await makeApiRequest(() =>
          api.songs.fetch[":id"].$get({
            param: { id: songId },
          }),
        );
        return new SongData(data);
      } catch (error) {
        console.error("Failed to fetch song:", error);
        return null;
      }
    },
    enabled: !!songId && !localSongData && !versionId,
    staleTime: Infinity,
    retry: 1,
  });

  // Combine local and fetched results
  const songData = localSongData || fetchedSong;

  // Only enable session sync for non-versioned songs
  const shouldShare = user.loggedIn && shareSession && !versionId;
  const masterId = user.loggedIn
    ? (user.profile.nickname ?? undefined)
    : undefined;

  const { updateSong, isConnected, connectedClients } = useSessionSync(
    masterId,
    shouldShare,
    shouldShare,
  );

  const [transposeSteps] = useLocalStorageState(`transposeSteps/${songId}`, {
    defaultValue: 0,
  });

  // Push new songs to the server (only for non-versioned songs)
  useEffect(() => {
    if (shouldShare && updateSong && songData?.id) {
      console.debug("Master updating song to:", songData.id);
      updateSong(songData.id, transposeSteps);
    }
  }, [songData?.id, shouldShare, updateSong, transposeSteps]);

  // Show loading state while fetching
  if (isLoading && !localSongData && !versionId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading song...</p>
      </div>
    );
  }

  // Show error state if song not found
  if (!songData && (isError || (!localSongData && !isLoading))) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className=" gap-4 outline-4 outline-primary p-6 rounded-xl">
          <p className="text-lg text-primary">Song not found</p>
          <p className="text-sm">
            The song with ID "{songId}" could not be found.
          </p>
        </div>
      </div>
    );
  }

  // Safety check
  if (!songData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <SongView
      songDB={songDB}
      songData={songData}
      user={user}
      feedStatus={
        versionId
          ? undefined // No session sync for versioned songs
          : {
              enabled: shouldShare,
              isConnected,
              isMaster: true,
              connectedClients: connectedClients ?? 0,
            }
      }
    />
  );
}
