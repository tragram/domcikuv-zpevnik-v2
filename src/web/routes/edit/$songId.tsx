import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import PendingComponent from "~/components/PendingComponent";
import Editor from "~/features/Editor/Editor";
import songLoader, { SongLoaderErrorComponent } from "~/services/song-loader";

export const Route = createFileRoute("/edit/$songId")({
  component: RouteComponent,
  validateSearch: z.object({
    version: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: songLoader,
  pendingMs: 200,
  pendingMinMs: 1000, // keep visible for at least 1s
  pendingComponent: () => (
    <PendingComponent
      title="Loading Song"
      text="Fetching the song from the DB..."
    />
  ),
  errorComponent: () => <SongLoaderErrorComponent from="/edit/$songId" />,
});

function RouteComponent() {
  const { user, songDB, versionId, songData } = Route.useLoaderData();

  return (
    <Editor
      songDB={songDB}
      songData={songData}
      user={user}
      versionId={versionId}
    />
  );
}
