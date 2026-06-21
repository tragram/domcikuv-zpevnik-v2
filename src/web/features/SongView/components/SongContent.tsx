import { useMemo } from "react";
import { SongData } from "~/types/songData";

import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { renderSong } from "../utils/songRendering";
import BackgroundImage from "./BackgroundImage";
import ResizableAutoTextSize from "./ResizableAutoTextSize";
import SongHeading from "./SongHeading";
import { UserData } from "src/web/hooks/use-user-data";
import { FeedStatus } from "../hooks/useSessionSync";
import { SongTranspose } from "../hooks/songTransposeMath";

interface SongContentProps {
  songData: SongData;
  gestureContainerRef: React.RefObject<HTMLDivElement | null>;
  userData?: UserData;
  transpose: SongTranspose;
  feedStatus?: FeedStatus;
  // Optional banner shown in the heading (e.g. version-fallback note).
  note?: string;
  // Owner name when viewing another user's songbook read-only (draft attribution).
  songbookOwnerName?: string;
}

export const SongContent = ({
  songData,
  gestureContainerRef,
  userData,
  transpose,
  feedStatus,
  note,
  songbookOwnerName,
}: SongContentProps) => {
  const { transposeSteps, effectiveKey } = transpose;
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
          transpose={transpose}
          userData={userData}
          feedStatus={feedStatus}
          note={note}
          songbookOwnerName={songbookOwnerName}
        />

        <div
          id="song-content-wrapper"
          dangerouslySetInnerHTML={{ __html: parsedContent }}
        />
      </ResizableAutoTextSize>
    </>
  );
};
