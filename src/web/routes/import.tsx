import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { externalSongSchema } from "src/worker/helpers/external-search";
import PendingComponent from "~/components/PendingComponent";
import { Button } from "~/components/ui/button";
import { ApiException, makeApiRequest } from "~/services/api-service";

export const Route = createFileRoute("/import")({
  validateSearch: (search) => externalSongSchema.parse(search),
  pendingMs: 0,
  pendingMinMs: 2000,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, preload, deps: { search } }) => {
    if (preload) {
      return;
    }

    try {
      const data = await makeApiRequest(
        () =>
          context.api.songs.external.import.$post({
            json: search,
          }),
        "Failed to import song",
      );

      throw redirect({
        to: "/song/$songId",
        params: { songId: data.songId },
      });
    } catch (error) {
      if (error instanceof Response) {
        throw error;
      }

      if (error instanceof ApiException) {
        let userMessage = error.message;
        let songId: string | undefined;

        if (error.status === 401) {
          userMessage = "You must be logged in to import songs";
        } else if (error.status === 422) {
          userMessage = "This song already exists in the database";
          if (error.code && typeof error.code === "string") {
            songId = error.code;
          }
        } else if (error.status === 502) {
          userMessage = "Failed to fetch song from source website";
        } else if (error.status === 500) {
          userMessage = "Could not extract lyrics from the source";
        }

        const customError = new Error(userMessage);
        (customError as any).songId = songId;
        throw customError;
      }

      throw error;
    }
  },
  pendingComponent: () => (
    <PendingComponent
      title="Importing Song"
      text="Please wait while the lyrics are being fetched..."
    />
  ),
  errorComponent: ({ error }) => {
    const songId = (error as any)?.songId;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full outline-primary outline-2 rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-primary">Import Failed</h1>
          <p className="text-700 mb-6">{error.message}</p>

          <Button variant="outline" asChild>
            {songId ? (
              <Link to="/song/$songId" params={{ songId }}>
                Go to Existing Song
              </Link>
            ) : (
              <Link to="/">Back to Home</Link>
            )}
          </Button>
        </div>
      </div>
    );
  },
});
