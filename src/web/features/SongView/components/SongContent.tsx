import { useMemo } from "react";
import { SongData } from "~/types/songData";
import { Key } from "~/types/musicTypes";

import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { renderSong } from "../utils/songRendering";
import BackgroundImage from "./BackgroundImage";
import ResizableAutoTextSize from "./ResizableAutoTextSize";
import SongHeading from "./SongHeading";
import { UserData } from "src/web/hooks/use-user-data";
import { FeedStatus } from "../hooks/useSessionSync";

interface SongContentProps {
  songData: SongData;
  transposeSteps: number;
  gestureContainerRef: React.RefObject<HTMLDivElement | null>;
  userData?: UserData;
  effectiveKey?: Key;
  feedStatus?: FeedStatus;
}

export const SongContent = ({
  songData,
  transposeSteps,
  gestureContainerRef,
  userData,
  effectiveKey,
  feedStatus,
}: SongContentProps) => {
  const { layout, chords: chordSettings } = useViewSettingsStore();

  const parsedContent = useMemo(
    () => renderSong(songData, transposeSteps, chordSettings.czechChordNames, effectiveKey),
    [songData, transposeSteps, chordSettings.czechChordNames, effectiveKey],
  );

  return (
    <>
      <BackgroundImage
        songData={songData}
        className="hidden"
        id="inner-background-image"
      />
      <ResizableAutoTextSize
        key={songData.id} // force a complete rerender on song change
        gestureContainerRef={gestureContainerRef}
        className=" dark:text-white/95"
      >
        <SongHeading
          songData={songData}
          layoutSettings={layout}
          transposeSteps={transposeSteps}
          userData={userData}
          feedStatus={feedStatus}
        />

        <div
          id="song-content-wrapper"
          dangerouslySetInnerHTML={{ __html: parsedContent }}
        />
      </ResizableAutoTextSize>
    </>
  );
};
