import { SongDB } from "~/types/types";
import { findOrFetchSong } from "./song-service";
import { API } from "src/worker/api-client";
import { UserProfileData } from "src/worker/api/userProfile";
import { RouteIds, useLoaderDeps, useParams } from "@tanstack/react-router";
import type { routeTree } from "~/routeTree.gen";
import { SongData } from "~/types/songData";

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

// Define the loader context type (adjust based on your actual context)
type SongLoaderContext = {
  songDB: SongDB;
  api: API;
  user: UserProfileData;
};

// Define the loader return type
export type SongLoaderData = {
  user: SongLoaderContext["user"];
  songDB: SongLoaderContext["songDB"];
  songData: SongData;
  songId: string;
  versionId?: string;
  api: SongLoaderContext["api"];
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
  const songDB = context.songDB;
  const songId = params.songId;
  const versionId = deps.version;
  const songData = await findOrFetchSong(
    context.api,
    songDB,
    songId,
    versionId,
  );

  if (!songData) {
    throw Error("Song not found!");
  }

  return {
    user: context.user,
    songDB,
    songData,
    songId,
    versionId,
    api: context.api,
  };
};

export default songLoader;
