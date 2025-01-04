
import { cn } from '@/lib/utils'
import { SongData } from '@/types/types'
import { forwardRef } from 'react'
import { useViewSettingsStore } from '../hooks/viewSettingsStore'
import { renderSong } from '../songRendering'
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
                <BackgroundImage songData={songData} className="hidden" id="inner-background-image"/>
                <div id="auto-text-size-wrapper" className={cn('flex w-full z-10 lg:px-16 p-4 sm:p-8  ', layout.fitScreenMode == "fitXY" ? "h-full" : "h-fit ", layout.fitScreenMode !== "fitXY" ? "mb-10" : "")}
                >
                    <ResizableAutoTextSize
                        gestureContainerRef={gestureContainerRef}>
                        <SongHeading
                            songData={songData}
                            layoutSettings={layout}
                            transposeSteps={transposeSteps}
                        />

                        <div
                            ref={ref} id="song-content-wrapper"
                            className={cn(
                                'max-w-screen dark:text-white/95',
                                chordSettings.inlineChords ? 'chords-inline' : '',
                                chordSettings.showChords ? '' : 'chords-hidden',
                                `fit-screen-${layout.fitScreenMode}`,
                                layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
                                layout.twoColumns ? 'song-content-columns' : ''
                            )}
                            dangerouslySetInnerHTML={{ __html: parsedContent }}
                        />
                    </ResizableAutoTextSize>
                </div >
            </>
        )
    }
)