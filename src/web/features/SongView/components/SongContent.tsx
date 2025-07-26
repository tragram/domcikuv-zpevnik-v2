import { SongData } from "~/types/songData";
import { forwardRef, useMemo } from "react";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { renderSong } from "../utils/songRendering";
import BackgroundImage from "./BackgroundImage";
import ResizableAutoTextSize from "./ResizableAutoTextSize";
import SongHeading from "./SongHeading";
import { ChordPro } from "~/types/types";

interface SongContentProps {
  songData: SongData;
  songContent: ChordPro;
  transposeSteps: number;
  gestureContainerRef: React.RefObject<HTMLDivElement>;
}

export const SongContent = forwardRef<HTMLDivElement, SongContentProps>(
  ({ songData, songContent, transposeSteps, gestureContainerRef }, ref) => {
    const { layout, chords: chordSettings } = useViewSettingsStore();

    const parsedContent = useMemo(
      () =>
        renderSong(
          songData,
          songContent,
          transposeSteps,
          chordSettings.czechChordNames
        ),
      [songData, songContent, transposeSteps, chordSettings.czechChordNames]
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
          />

          <div
            ref={ref}
            id="song-content-wrapper"
            dangerouslySetInnerHTML={{ __html: parsedContent }}
          />
        </ResizableAutoTextSize>
      </>
    );
  }
);
