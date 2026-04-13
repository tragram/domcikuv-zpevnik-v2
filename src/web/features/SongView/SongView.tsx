import { useEffect, useRef, useState } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";

import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { FeedStatusBar } from "./components/FeedStatusBar";
import ScrollButtons from "./components/ScrollButtons";
import { SongContent } from "./components/SongContent";
import { SongViewLayout } from "./components/SongViewLayout";
import { FeedStatus } from "./hooks/useSessionSync";
import { useViewSettingsStore } from "./hooks/viewSettingsStore";
import { Toolbar } from "./settings/Toolbar";
import "./SongView.css";
import { UserData } from "src/web/hooks/use-user-data";

type DataForSongView = {
  songData: SongData;
  userData: UserData;
  feedStatus?: FeedStatus;
};
export const SongView = ({
  songData,
  userData,
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
        songData={songData}
        userData={userData}
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
          userData={userData}
        />
      </FullScreen>
      <FeedStatusBar feedStatus={feedStatus} />
    </SongViewLayout>
  );
};
export default SongView;
