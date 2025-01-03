
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLoaderData } from 'react-router-dom'
import { useFullScreenHandle } from 'react-full-screen'
import { useGesture } from '@use-gesture/react'
import { cn } from '@/lib/utils'
import { DataForSongView } from '@/components/song_loader'
import { Toolbar } from './settings/Toolbar'
import PdfView from './components/pdfView'
import { getFontSizeInRange, useViewSettingsStore } from './hooks/viewSettingsStore'
import { SongViewLayout } from './components/SongViewLayout'
import { SongContent } from './components/SongContent'
import { FullScreen } from 'react-full-screen'
import ScrollButtons from './components/ScrollButtons'
import './SongView.css'
import { useToolbarVisibility } from './hooks/useToolbarVisibility'
import useLocalStorageState from 'use-local-storage-state'


export const SongView = () => {
    const { songDB, songData } = useLoaderData() as DataForSongView;
    const fullScreenHandle = useFullScreenHandle();
    const viewRef = useRef<HTMLDivElement>(null);
    const {
        layout: layoutSettings,
    } = useViewSettingsStore()
    const [transposeSteps, setTransposeSteps] = useLocalStorageState(`transposeSteps/${songData.id}`, { defaultValue: 0 });


    // Prevent default gesture behavior
    useEffect(() => {
        const preventDefault = (e: Event) => e.preventDefault()
        document.addEventListener('gesturestart', preventDefault)
        document.addEventListener('gesturechange', preventDefault)

        return () => {
            document.removeEventListener('gesturestart', preventDefault)
            document.removeEventListener('gesturechange', preventDefault)
        }
    }, [])

    // Render PDF view for short songs
    if (songData.lyricsLength() < 50) {
        return <PdfView pdfFilenames={songData.pdfFilenames} />
    }

    return (
        <SongViewLayout
            ref={viewRef}
        >
            <Toolbar
                songDB={songDB}
                songData={songData}
                fullScreenHandle={fullScreenHandle}
                originalKey={songData.key}
                transposeSteps={transposeSteps}
                setTransposeSteps={setTransposeSteps}
            />
            <FullScreen handle={fullScreenHandle} className={cn('w-full overflow-x-clip', layoutSettings.fitScreenMode == "fitXY" ? " h-full " : " h-fit")}>
                <ScrollButtons
                    fitScreenMode={layoutSettings.fitScreenMode}
                />
                <SongContent
                    songData={songData}
                    transposeSteps={transposeSteps}
                    containerRef={viewRef}
                />
            </FullScreen>
        </SongViewLayout>
    )

}
export default SongView;   