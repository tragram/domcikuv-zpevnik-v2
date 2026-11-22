import { assetLoadError } from "~/lib/asset-load-error";
import { CustomError } from "~/components/CustomError";
import { useQuery } from "@tanstack/react-query";
import { singleSongQueryOptions } from "~/services/song-service";
import { SongData } from "~/types/songData";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useUserData } from "src/web/hooks/use-user-data";
import { z } from "zod";
import SongView from "~/features/SongView/SongView";
import { useSessionSync } from "~/features/SongView/hooks/useSessionSync";
import { useViewSettingsStore } from "~/features/SongView/hooks/viewSettingsStore";
import songLoader, {
  SongLoaderErrorComponent,
  SongPendingComponent,
} from "~/services/song-loader";

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
  pendingMinMs: 0, // A genuine cache miss should not add an artificial 1s delay.
  pendingComponent: SongPendingComponent,
  errorComponent: (props) => assetLoadError.test(props.error.message) ? <CustomError {...props} /> : <SongLoaderErrorComponent from="/song/$songId" />,
});

function RouteComponent() {
  const {
    songData,
    versionId,
    personalizationOverride,
    versionSelection,
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

  // A host checks the live sheet on entry, reconnect, and during a long session.
  const liveSheet = useQuery({
    ...singleSongQueryOptions(songData.id, songData.versionId),
    enabled: shouldShare && !!songData.versionId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    select: (row) => new SongData(row),
  });
  const hostSheet = shouldShare && liveSheet.data?.versionId === songData.versionId
    ? liveSheet.data : undefined;
  const verified = !!hostSheet && liveSheet.isFetchedAfterMount && liveSheet.isSuccess;
  return (
    <SongView
      songData={hostSheet ?? songData}
      userData={userData}
      feedStatus={versionId ? undefined : feedStatus}
      versionSelection={versionSelection}
      songbook={
        personalizationOverride
          ? {
              override: personalizationOverride,
            }
          : undefined
      }
      broadcast={{ shouldShare: verified, updateSong }}
    />
  );
}
