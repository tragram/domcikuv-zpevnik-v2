import { useEffect, useRef, useState } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";
import { UserProfileData } from "src/worker/api/userProfile";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { SongDB } from "~/types/types";
import ScrollButtons from "./components/ScrollButtons";
import { SongContent } from "./components/SongContent";
import { SongViewLayout } from "./components/SongViewLayout";
import { useViewSettingsStore } from "./hooks/viewSettingsStore";
import { Toolbar } from "./settings/Toolbar";
import { FeedStatusBar } from "./components/FeedStatusBar";
import "./SongView.css";
import { SessionSyncState } from "src/worker/durable-objects/SessionSync";
import { FavoritesAPI } from "src/worker/api-client";

export type FeedStatus = {
  isMaster: boolean;
  enabled: boolean;
  isConnected: boolean;
  connectedClients: number;
  sessionState?: SessionSyncState;
};

type DataForSongView = {
  songDB: SongDB;
  songData: SongData;
  user: UserProfileData;
  favoritesApi?: FavoritesAPI;
  feedStatus?: FeedStatus;
};
export const SongView = ({
  songDB,
  songData,
  user,
  favoritesApi,
  feedStatus,
}: DataForSongView) => {
  const fullScreenHandle = useFullScreenHandle();
  const gestureContainerRef = useRef<HTMLDivElement>(null);
  const { layout: layoutSettings } = useViewSettingsStore();

  const storeTransposeSteps = useViewSettingsStore(
    (state) => state.transpositions[songData.id] || 0,
  );
  const setStoreTranspose = useViewSettingsStore(
    (state) => state.actions.setTranspose,
  );
  const [followerTranspose, setFollowerTranspose] = useState<number | null>(
    null,
  );
  const [lastSyncedMaster, setLastSyncedMaster] = useState({
    songId: songData.id,
    transpose: feedStatus?.sessionState?.transposeSteps,
  });

  const isFollower = feedStatus?.enabled && !feedStatus.isMaster;
  const currentMasterSteps = feedStatus?.sessionState?.transposeSteps;

  if (isFollower) {
    const songChanged = lastSyncedMaster.songId !== songData.id;
    const transposeChanged = currentMasterSteps !== lastSyncedMaster.transpose;

    // Force sync ONLY if the master actively broadcasts a new transposition or changes songs
    if (songChanged || (currentMasterSteps !== undefined && transposeChanged)) {
      setLastSyncedMaster({
        songId: songData.id,
        transpose: currentMasterSteps,
      });
      setFollowerTranspose(currentMasterSteps ?? null);
    }
  }
  const transposeSteps =
    isFollower && followerTranspose !== null
      ? followerTranspose
      : storeTransposeSteps;

  const handleSetTransposeSteps = (steps: number) => {
    setStoreTranspose(songData.id, steps);

    if (isFollower) {
      setFollowerTranspose(steps);
    }
  };

  // Prevent default gesture behavior
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventDefault);
    document.addEventListener("gesturechange", preventDefault);

    return () => {
      document.removeEventListener("gesturestart", preventDefault);
      document.removeEventListener("gesturechange", preventDefault);
    };
  }, []);

  return (
    <SongViewLayout ref={gestureContainerRef}>
      <Toolbar
        songDB={songDB}
        songData={songData}
        user={user}
        fullScreenHandle={fullScreenHandle}
        originalKey={songData.key}
        feedStatus={feedStatus}
        transposeSteps={transposeSteps}
        setTransposeSteps={handleSetTransposeSteps}
      />
      <FullScreen
        handle={fullScreenHandle}
        className={cn(
          "fullscreen-wrapper w-full overflow-x-clip",
          layoutSettings.fitScreenMode == "fitXY"
            ? " h-full "
            : "h-fit overflow-y-auto",
          feedStatus?.enabled ? "pb-8" : "",
        )}
      >
        <ScrollButtons fitScreenMode={layoutSettings.fitScreenMode} />
        <SongContent
          songData={songData}
          transposeSteps={transposeSteps}
          gestureContainerRef={gestureContainerRef}
          favoritesApi={favoritesApi}
          user={user}
        />
      </FullScreen>
      <FeedStatusBar feedStatus={feedStatus} />
    </SongViewLayout>
  );
};
export default SongView;
