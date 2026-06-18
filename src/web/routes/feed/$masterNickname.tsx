import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserData, useUserData } from "src/web/hooks/use-user-data";
import { API } from "src/worker/api-client";

import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import { SongDataApi } from "src/worker/api/api-types";
import { useMasterRelay } from "~/features/SongView/hooks/useMasterRelay";
import { useShareSessionToggle } from "~/features/SongView/hooks/useShareSessionToggle";
import SongView from "~/features/SongView/SongView";
import { handleApiResponse } from "~/services/api-service";
import { fetchFeed } from "~/services/song-service";
import { SongData } from "~/types/songData";

export const Route = createFileRoute("/feed/$masterNickname")({
  component: RouteComponent,
  loader: async ({ context, params }) => {
    const liveState = await fetchFeed(context.api, params.masterNickname);
    return {
      masterNickname: params.masterNickname,
      liveState,
      api: context.api,
    };
  },
});

function RouteComponent() {
  const { liveState, masterNickname, api } = Route.useLoaderData();

  const { userData } = useUserData();
  return (
    <FeedView
      masterNickname={masterNickname}
      liveState={liveState}
      userData={userData}
      api={api}
    />
  );
}

type FeedViewProps = {
  liveState?: SessionSyncState;
  masterNickname: string;
  userData: UserData;
  api: API;
};

function FeedView({ liveState, masterNickname, userData, api }: FeedViewProps) {
  // The user's own identity — needed for relay and loop detection. Sessions are
  // addressed by nickname only, so a user without one cannot relay (they have no
  // own feed URL); the relay hook falls back to plain following.
  const ownNickname = userData?.profile?.nickname ?? undefined;
  const ownMasterId = userData?.profile?.id ?? undefined;

  // Relay is enabled only when the user has sharing turned on in their song view
  const { shareSession } = useShareSessionToggle();

  // useMasterRelay subsumes plain useSessionSync:
  //   • When shareEnabled=false (or isSelf) it behaves as a regular follower.
  //   • When shareEnabled=true it opens a second (downstream) WS to relay the
  //     target's content to the user's own followers, with full loop detection.
  const { feedStatus } = useMasterRelay({
    targetNickname: masterNickname,
    ownNickname,
    ownMasterId,
    shareEnabled: shareSession,
    initialState: liveState,
  });

  const navigate = useNavigate();

  // Follow URL nickname redirects (e.g. if the master's profile changes)
  const currentMasterNickname = feedStatus.sessionState?.masterNickname;
  useEffect(() => {
    if (currentMasterNickname && currentMasterNickname !== masterNickname) {
      navigate({
        to: "/feed/$masterNickname",
        params: { masterNickname: currentMasterNickname },
        replace: true,
      });
    }
  }, [currentMasterNickname, masterNickname, navigate]);

  const currentSongId = feedStatus.sessionState?.songId;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentSongId]);
  const currentVersionId = feedStatus.sessionState?.versionId;
  const { data: songData } = useQuery({
    queryKey: ["song", currentSongId, currentVersionId],
    enabled: !!currentSongId,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = currentVersionId
        ? await api.songs.fetch[":songId"][":versionId"].$get({
            param: { songId: currentSongId!, versionId: currentVersionId },
          })
        : await api.songs.fetch[":id"].$get({
            param: { id: currentSongId! },
          });

      return await handleApiResponse<{ data: SongDataApi }>(response);
    },
    select: (data: SongData | SongDataApi): SongData =>
      data instanceof SongData ? data : new SongData(data),
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });

  if (!feedStatus.sessionState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg">Connecting to feed...</p>
          {!feedStatus.isConnected && feedStatus.retryAttempt > 2 && (
            <p className="text-xs text-gray-400">
              Having trouble connecting but I'll keep trying in the background.
              ;-)
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!songData || !feedStatus.sessionState.songId) {
    const isEnded =
      !feedStatus.sessionState.isMasterConnected &&
      feedStatus.sessionState.songId === null;

    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-lg">
            {isEnded
              ? `${masterNickname} stopped sharing their feed.`
              : `Waiting for ${masterNickname} to select a song...`}
          </p>
          {!feedStatus.isConnected && !isEnded && (
            <p className="text-sm text-yellow-600">
              Connection lost - attempting to reconnect...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <SongView songData={songData} userData={userData} feedStatus={feedStatus} />
  );
}
