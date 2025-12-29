import { useEffect, useRef } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";
import useLocalStorageState from "use-local-storage-state";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { SongDB } from "~/types/types";
import ScrollButtons from "./components/ScrollButtons";
import { SongContent } from "./components/SongContent";
import { SongViewLayout } from "./components/SongViewLayout";
import { useViewSettingsStore } from "./hooks/viewSettingsStore";
import { Toolbar } from "./settings/Toolbar";
import "./SongView.css";
import { UserProfileData } from "src/worker/api/userProfile";

type DataForSongView = {
  songDB: SongDB;
  songData: SongData;
  user: UserProfileData;
};

export const SongView = ({
  songDB,
  songData,
  user,
}: DataForSongView) => {
  const fullScreenHandle = useFullScreenHandle();
  const gestureContainerRef = useRef<HTMLDivElement>(null);
  const { layout: layoutSettings } = useViewSettingsStore();
  const [transposeSteps, setTransposeSteps] = useLocalStorageState(
    `transposeSteps/${songData.id}`,
    { defaultValue: 0 }
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
        songDB={songDB}
        songData={songData}
        user={user}
        fullScreenHandle={fullScreenHandle}
        originalKey={songData.key}
        transposeSteps={transposeSteps}
        setTransposeSteps={setTransposeSteps}
      />
      <FullScreen
        handle={fullScreenHandle}
        className={cn(
          "fullscreen-wrapper w-full overflow-x-clip",
          layoutSettings.fitScreenMode == "fitXY"
            ? " h-full "
            : "h-fit overflow-y-auto"
        )}
      >
        <ScrollButtons fitScreenMode={layoutSettings.fitScreenMode} />
        <SongContent
          songData={songData}
          transposeSteps={transposeSteps}
          gestureContainerRef={gestureContainerRef}
        />
      </FullScreen>
    </SongViewLayout>
  );
};
export default SongView;