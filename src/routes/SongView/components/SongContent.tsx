
import React, { forwardRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CustomAutoTextSize } from '../CustomAutoTextSize'
import SongHeading from '../SongHeading'
import { SongData } from '@/types'
import { useViewSettingsStore } from '../hooks/viewSettingsStore'
import BackgroundImage from './BackgroundImage'

interface SongContentProps {
    songData: SongData
    parsedContent: string
}

export const SongContent = forwardRef<HTMLDivElement, SongContentProps>(
    ({ songData, parsedContent }, ref) => {
        const { layout, chords, transpose, actions } = useViewSettingsStore();

        const setFontSize = useCallback((fontSize: number) => {
            actions.setLayoutSettings({ fontSize })
        }, [actions]);

        const autoTextSizeProps = useMemo(() => ({
            fitMode: layout.fitScreenMode,
            minFontSizePx: 4,
            maxFontSizePx: 160,
            fontSize: layout.fontSize,
            setFontSize,
        }), [layout.fitScreenMode, layout.fontSize, setFontSize]);

        return (
            <>
                <BackgroundImage songData={songData} className="hidden" id="inner-background-image" />
                <div id="auto-text-size-wrapper" className={cn('w-full z-10 lg:px-16 p-4 sm:p-8', layout.fitScreenMode == "fitXY" ? "h-full " : "h-fit ", layout.fitScreenMode !== "fitXY" ? "mb-10" : "")}
                >
                    <CustomAutoTextSize {...autoTextSizeProps}>
                        <SongHeading
                            songData={songData}
                            layoutSettings={layout}
                            transposeSteps={transpose.steps}
                        />

                        <div
                            ref={ref} id="song-content-wrapper"
                            className={cn(
                                'flex flex-col max-w-screen',
                                chords.inlineChords ? 'chords-inline' : '',
                                chords.showChords ? '' : 'chords-hidden',
                                `fit-screen-${layout.fitScreenMode}`,
                                layout.repeatPartsChords ? '' : 'repeated-chords-hidden',
                                layout.twoColumns ? 'song-content-columns' : ''
                            )}
                            dangerouslySetInnerHTML={{ __html: parsedContent }}
                        />
                    </CustomAutoTextSize>
                </div>
            </>
        )
    }
)