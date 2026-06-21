import { useEffect, useRef } from "react";
import { FullScreen, useFullScreenHandle } from "react-full-screen";

import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { UserData } from "src/web/hooks/use-user-data";
import { FeedStatusBar } from "./components/FeedStatusBar";
import ScrollButtons from "./components/ScrollButtons";
import { SongContent } from "./components/SongContent";
import { SongViewLayout } from "./components/SongViewLayout";
import { FeedStatus } from "./hooks/useSessionSync";
import { SongbookOverride } from "./hooks/songTransposeMath";
import { useSongTranspose } from "./hooks/useSongTranspose";
import { useViewSettingsStore } from "./hooks/viewSettingsStore";
import { Toolbar } from "./settings/Toolbar";
import "./SongView.css";

type DataForSongView = {
  songData: SongData;
  userData: UserData;
  feedStatus?: FeedStatus;
  // Present only when browsing another user's songbook (read-only): their saved
  // key/capo, display name, and whether their pinned version fell back to the
  // official one. Its presence is what puts the view in read-only mode.
  songbook?: {
    override: SongbookOverride;
    ownerName?: string;
    versionUnavailable?: boolean;
  };
  // Master-broadcast wiring (song route only). The resolved transpose is pushed
  // to followers; absent on the feed/follower route, so the effect stays inert.
  broadcast?: {
    shouldShare: boolean;
    updateSong: (
      songId: string,
      transposeSteps: number,
      versionId?: string,
    ) => void;
  };
};

/**
 * Renders a song with its key/capo. A single transpose hook handles both modes
 * (the viewer's own song vs a read-only foreign songbook), selected by
 * `songbook`.
 */
export const SongView = ({
  songData,
  userData,
  feedStatus,
  songbook,
  broadcast,
}: DataForSongView) => {
  const transpose = useSongTranspose(
    songData,
    userData,
    feedStatus,
    songbook?.override,
  );
  const fullScreenHandle = useFullScreenHandle();
  const gestureContainerRef = useRef<HTMLDivElement>(null);
  const { layout: layoutSettings } = useViewSettingsStore();

  // Master broadcast: push the *displayed* transpose to followers, read from the
  // hook's resolved value (not the raw store), so a saved key broadcasts even
  // with an untouched local store. Inert when not sharing / on the feed route.
  useEffect(() => {
    if (broadcast?.shouldShare) {
      broadcast.updateSong(
        songData.id,
        transpose.transposeSteps,
        songData.versionId,
      );
    }
  }, [
    broadcast?.shouldShare,
    broadcast?.updateSong,
    songData.id,
    songData.versionId,
    transpose.transposeSteps,
  ]);

  // Prevent default pinch-zoom gesture behavior.
  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventDefault);
    document.addEventListener("gesturechange", preventDefault);
    return () => {
      document.removeEventListener("gesturestart", preventDefault);
      document.removeEventListener("gesturechange", preventDefault);
    };
  }, []);

  const note = songbook?.versionUnavailable
    ? `Showing the official version — ${songbook.ownerName ?? "the owner"}'s saved version isn't available.`
    : undefined;

  return (
    <SongViewLayout ref={gestureContainerRef}>
      <Toolbar
        songData={songData}
        userData={userData}
        transpose={transpose}
        fullScreenHandle={fullScreenHandle}
        feedStatus={feedStatus}
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
          gestureContainerRef={gestureContainerRef}
          userData={userData}
          transpose={transpose}
          feedStatus={feedStatus}
          note={note}
          songbookOwnerName={songbook?.ownerName}
        />
      </FullScreen>
      <FeedStatusBar feedStatus={feedStatus} />
    </SongViewLayout>
  );
};

export default SongView;
