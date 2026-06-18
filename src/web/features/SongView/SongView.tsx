import { useEffect, useMemo, useRef } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";

import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { FeedStatusBar } from "./components/FeedStatusBar";
import ScrollButtons from "./components/ScrollButtons";
import { SongContent } from "./components/SongContent";
import { SongViewLayout } from "./components/SongViewLayout";
import { FeedStatus } from "./hooks/useSessionSync";
import { useTransposeSteps } from "./hooks/useTransposeSteps";
import { useViewSettingsStore } from "./hooks/viewSettingsStore";
import { Toolbar } from "./settings/Toolbar";
import "./SongView.css";
import { UserData } from "src/web/hooks/use-user-data";
import { guessKey } from "./utils/songRendering";

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
  const [transposeSteps, setTransposeSteps] = useTransposeSteps(
    songData.id,
    feedStatus,
  );

  const effectiveKey = useMemo(
    () => songData.key ?? guessKey(songData.chordpro),
    [songData],
  );

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
        originalKey={effectiveKey}
        feedStatus={feedStatus}
        transposeSteps={transposeSteps}
        setTransposeSteps={setTransposeSteps}
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
          effectiveKey={effectiveKey}
        />
      </FullScreen>
      <FeedStatusBar feedStatus={feedStatus} />
    </SongViewLayout>
  );
};
export default SongView;
