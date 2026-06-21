import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useUserData } from "src/web/hooks/use-user-data";
import { z } from "zod";
import PendingComponent from "~/components/PendingComponent";
import SongView from "~/features/SongView/SongView";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import { useViewSettingsStore } from "~/features/SongView/hooks/viewSettingsStore";
import songLoader, { SongLoaderErrorComponent } from "~/services/song-loader";

const songSearchSchema = z.object({
  version: z.string().optional(),
  // Owner userId when opened from someone else's songbook.
  songbook: z.string().optional(),
});

export const Route = createFileRoute("/song/$songId")({
  validateSearch: songSearchSchema,
  component: RouteComponent,
  loaderDeps: ({ search }) => ({
    version: search.version,
    songbook: search.songbook,
  }),
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
  const {
    songData,
    versionId,
    personalizationOverride,
    songbookOwnerName,
    versionUnavailable,
  } = Route.useLoaderData();
  const { userData } = useUserData();
  const shareSession = useViewSettingsStore((state) => state.shareSession);

  // Sessions are addressed by nickname only; without one the user cannot share.
  const masterNickname = userData?.profile.nickname ?? undefined;
  const shouldShare = !!masterNickname && shareSession;

  const navigate = useNavigate();
  const { updateSong, feedStatus } = useSessionSync({
    masterNickname,
    isMaster: shouldShare,
    enabled: shouldShare,
    onKicked: masterNickname
      ? () =>
          navigate({
            to: "/feed/$masterNickname",
            params: { masterNickname },
            replace: true,
          })
      : undefined,
  });

  return (
    <SongView
      songData={songData}
      userData={userData}
      feedStatus={versionId ? undefined : feedStatus}
      songbook={
        personalizationOverride
          ? {
              override: personalizationOverride,
              ownerName: songbookOwnerName,
              versionUnavailable,
            }
          : undefined
      }
      broadcast={{ shouldShare, updateSong }}
    />
  );
}
