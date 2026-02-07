import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import { ApiException, makeApiRequest } from "~/services/api-service";

export const Route = createFileRoute("/pa/$")({
  pendingMs: 0, // Show pending immediately
  pendingMinMs: 2000, // keep visible for at least 500ms
  loader: async ({ params, context, preload }) => {
    // Don't run import on preload (e.g., from hover)
    if (preload) {
      return;
    }

    // encodeURIComponent handles slashes within the splat
    const encodedSlug = encodeURIComponent(params._splat || "");

    try {
      // Using makeApiRequest with Hono client from context
      const data = await makeApiRequest(
        () =>
          context.api.songs.import.pa[":slug"].$get({
            param: { slug: encodedSlug },
          }),
        "Failed to import song",
      );

      // On success, redirect to the song page
      throw redirect({
        to: "/song/$songId",
        params: { songId: data.songId },
      });
    } catch (error) {
      // Re-throw redirect as-is
      if (error instanceof Response) {
        throw error;
      }

      // Handle ApiException with user-friendly messages
      if (error instanceof ApiException) {
        let userMessage = error.message;
        let songId: string | undefined;

        // Provide specific error messages based on status codes
        if (error.status === 401) {
          userMessage = "You must be logged in to import songs";
        } else if (error.status === 422) {
          userMessage = "This song already exists in the database";
          // The backend can pass the songId in the code field
          if (error.code && typeof error.code === "string") {
            songId = error.code;
          }
        } else if (error.status === 502) {
          userMessage = "Failed to fetch song from source website";
        } else if (error.status === 500) {
          userMessage = "Could not extract song data from the source";
        }

        const customError = new Error(userMessage);
        // Attach songId to the error for the error component to use
        (customError as any).songId = songId;
        throw customError;
      }

      // Re-throw other errors
      throw error;
    }
  },
  pendingComponent: () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full outline-primary outline-2 rounded-lg shadow-lg p-6 text-center">
        <div className="mb-4">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">Importing Song</h1>
        <p className="text-700">
          Please wait while the song is being scraped...
        </p>
      </div>
    </div>
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
