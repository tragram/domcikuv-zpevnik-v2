import { SongData } from '@/types/types'
import { forwardRef } from 'react'
import { useViewSettingsStore } from '../hooks/viewSettingsStore'
import { renderSong } from '../utils/songRendering'
import BackgroundImage from './BackgroundImage'
import ResizableAutoTextSize from './ResizableAutoTextSize'
import SongHeading from './SongHeading'

interface SongContentProps {
    songData: SongData
    transposeSteps: number
    gestureContainerRef: React.RefObject<HTMLDivElement>
}

export const SongContent = forwardRef<HTMLDivElement, SongContentProps>(
    ({ songData, transposeSteps, gestureContainerRef }, ref) => {
        const { layout, chords: chordSettings } = useViewSettingsStore();

        const parsedContent = renderSong(
            songData,
            transposeSteps,
            layout.repeatParts,
            chordSettings.czechChordNames
        );

        return (
            <>
                <BackgroundImage songData={songData} className="hidden" id="inner-background-image" />
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
        )
    }
)