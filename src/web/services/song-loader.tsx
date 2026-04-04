import { QueryClient } from "@tanstack/react-query";
import { RouteIds, useLoaderDeps, useParams } from "@tanstack/react-router";
import {
  songsQueryOptions
} from "~/hooks/use-songDB";
import type { routeTree } from "~/routeTree.gen";
import { SongData } from "~/types/songData";
import { findOrFetchSong } from "./song-service";

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

  const songs = queryClient.getQueryData(songsQueryOptions().queryKey) ?? [];

  const songData = await findOrFetchSong(songs, params.songId, deps.version);
  if (!songData) throw new Error("Song not found!");

  return { songData, songId: params.songId, versionId: deps.version };
};

export default songLoader;
