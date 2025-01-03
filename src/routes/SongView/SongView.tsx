
import { DataForSongView } from '@/components/song_loader'
import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'
import { useLoaderData } from 'react-router-dom'
import useLocalStorageState from 'use-local-storage-state'
import PdfView from './components/pdfView'
import ScrollButtons from './components/ScrollButtons'
import { SongContent } from './components/SongContent'
import { SongViewLayout } from './components/SongViewLayout'
import { useViewSettingsStore } from './hooks/viewSettingsStore'
import { Toolbar } from './settings/Toolbar'
import './SongView.css'


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