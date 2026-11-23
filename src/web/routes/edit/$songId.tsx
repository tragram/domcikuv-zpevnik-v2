import { assetLoadError } from "~/lib/asset-load-error";
import { CustomError } from "~/components/CustomError";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/mini";
import PendingComponent from "~/components/PendingComponent";
import Editor from "~/features/Editor/Editor";
import songLoader, { SongLoaderErrorComponent } from "~/services/song-loader";

export const Route = createFileRoute("/edit/$songId")({
  component: RouteComponent,
  validateSearch: z.object({
    version: z.optional(z.string()),
  }),
  loaderDeps: ({ search }) => ({ version: search.version }),
  loader: (args) => songLoader({ ...args, editing: true }),
  pendingMs: 200,
  pendingMinMs: 1000, // keep visible for at least 1s
  pendingComponent: () => (
    <PendingComponent
      title="Loading Song"
      text="Fetching the song from the DB..."
    />
  ),
  errorComponent: (props) => assetLoadError.test(props.error.message) ? <CustomError {...props} /> : <SongLoaderErrorComponent from="/edit/$songId" />,
});

function RouteComponent() {
  const { versionId, songData } = Route.useLoaderData();
  return (
    <Editor
      songData={songData}
      versionId={versionId ?? songData.versionId}
    />
  );
}
