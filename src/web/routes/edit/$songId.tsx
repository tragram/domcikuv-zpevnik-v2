import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Editor from "~/features/Editor/Editor";
import { makeApiRequest } from "~/services/apiHelpers";
import { SongData } from "~/types/songData";
import { z } from "zod";

export const Route = createFileRoute("/edit/$songId")({
  component: RouteComponent,
  validateSearch: z.object({
    version: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: async ({ context, params, deps }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const versionId = deps.version;

    return {
      user: context.user,
      songDB,
      songId: params.songId,
      versionId,
      api: context.api,
      // Only set local data if we are NOT looking for a specific version
      // and the song exists in the global cache
      localSongData: !versionId
        ? songDB.songs.find((s) => s.id === songId)
        : undefined,
    };
  },
});

function RouteComponent() {
  const { user, songDB, localSongData, songId, versionId, api } =
    Route.useLoaderData();

  const {
    data: fetchedSong,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["song", songId, versionId],
    queryFn: async () => {
      // Branch 1: Specific version requested
      if (versionId) {
        const response = await makeApiRequest(() =>
          api.songs.fetch[":songId"][":versionId"].$get({
            param: { songId, versionId },
          }),
        );
        return new SongData(response);
      }

      // Branch 2: No version requested, but not found in local context
      const response = await makeApiRequest(() =>
        api.songs.fetch[":id"].$get({
          param: { id: songId },
        }),
      );
      return new SongData(response);
    },
    // Enable fetching if:
    // 1. We requested a specific version (we generally don't cache all versions in context)
    // 2. OR we didn't find the main song in the local context
    enabled: !!versionId || !localSongData,
    staleTime: Infinity,
    retry: 1,
  });

  // Use local data if available and no specific version was requested, otherwise use fetched data
  const songData = !versionId && localSongData ? localSongData : fetchedSong;

  if (isLoading && !songData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading song...</p>
      </div>
    );
  }

  if (!songData && (isError || (!localSongData && !isLoading))) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="gap-4 outline-4 outline-primary p-6 rounded-xl">
          <p className="text-lg text-primary">Song not found</p>
          <p className="text-sm">
            The song with ID "{songId}" could not be found.
          </p>
        </div>
      </div>
    );
  }

  if (!songData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Editor
      songDB={songDB}
      songData={songData}
      user={user}
      versionId={versionId}
    />
  );
}
