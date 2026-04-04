import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import PendingComponent from "~/components/PendingComponent";
import SongView from "~/features/SongView/SongView";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import { useViewSettingsStore } from "~/features/SongView/hooks/viewSettingsStore";
import { useUserProfile } from "~/hooks/use-user-profile";
import songLoader, { SongLoaderErrorComponent } from "~/services/song-loader";

const songSearchSchema = z.object({
  version: z.string().optional(),
});

export const Route = createFileRoute("/song/$songId")({
  validateSearch: songSearchSchema,
  component: RouteComponent,
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
  errorComponent: () => <SongLoaderErrorComponent from="/song/$songId" />,
});

function RouteComponent() {
  const { songData, songId, versionId } = Route.useLoaderData();
  const { userProfile: user } = useUserProfile();
  const shareSession = useViewSettingsStore((state) => state.shareSession);
  const transposeSteps = useViewSettingsStore(
    (state) => state.transpositions[songId] || 0,
  );

  // Only enable session sync for non-versioned songs
  const shouldShare = user.loggedIn && shareSession && !versionId;
  const masterId = user.loggedIn
    ? (user.profile.nickname ?? undefined)
    : undefined;

  const { updateSong, feedStatus } = useSessionSync(
    masterId,
    shouldShare,
    shouldShare,
  );

  // Push new songs & transpositions to the server (only for non-versioned songs)
  useEffect(() => {
    if (shouldShare && updateSong && songData?.id) {
      console.debug(
        "Master updating song to:",
        songData.id,
        "with transpose:",
        transposeSteps,
      );
      updateSong(songData.id, transposeSteps);
    }
  }, [songData?.id, shouldShare, updateSong, transposeSteps]);

  return (
    <SongView
      songData={songData}
      user={user}
      feedStatus={versionId ? undefined : feedStatus}
    />
  );
}
