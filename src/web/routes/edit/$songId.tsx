import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Editor from "~/features/Editor/Editor";
import { handleApiResponse } from "~/services/apiHelpers";
import { SongData } from "~/types/songData";

export const Route = createFileRoute("/edit/$songId")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const songDB = context.songDB;
    const songId = params.songId;
    const songData = songDB.songs.find((s) => s.id === songId);

    return {
      user: context.user,
      songDB,
      songData,
      songId: params.songId,
      api: context.api,
    };
  },
});

function RouteComponent() {
  const {
    user,
    songDB,
    songData: localSongData,
    songId,
    api,
  } = Route.useLoaderData();

  // Try fetching from API if not found locally
  const {
    data: fetchedSong,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["song", songId],
    queryFn: async () => {
      if (!songId || localSongData) return null;

      try {
        const response = await api.songs.fetch[":id"].$get({
          param: { id: songId },
        });
        const data = await handleApiResponse(response);
        return new SongData(data);
      } catch (error) {
        console.error("Failed to fetch song:", error);
        return null;
      }
    },
    enabled: !!songId && !localSongData,
    staleTime: Infinity, // Once fetched, keep it
    retry: 1, // Only retry once
  });

  // Combine local and fetched results
  const songData = localSongData || fetchedSong;

  // Show loading state while fetching
  if (isLoading && !localSongData) {
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
        <div className="gap-4 outline-4 outline-primary p-6 rounded-xl">
          <p className="text-lg text-primary">Song not found</p>
          <p className="text-sm">
            The song with ID "{songId}" could not be found.
          </p>
        </div>
      </div>
    );
  }

  // Shouldn't happen, but safety check
  if (!songData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return <Editor songDB={songDB} songData={songData} user={user} />;
}
