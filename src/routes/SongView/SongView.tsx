
import { useEffect, useRef } from 'react'
import { useNavigate, useLoaderData } from 'react-router-dom'
import { useFullScreenHandle } from 'react-full-screen'
import { useGesture } from '@use-gesture/react'
import { cn } from '@/lib/utils'
import { DataForSongView } from '@/components/song_loader'
import { Toolbar } from './settings/Toolbar'
import PdfView from './components/pdfView'
import { useViewSettingsStore } from './hooks/viewSettingsStore'
import { SongViewLayout } from './components/SongViewLayout'
import { SongContent } from './components/SongContent'
import { FullScreen } from 'react-full-screen'
import ScrollButtons from './components/ScrollButtons'
import './SongView.css'
import { useToolbarVisibility } from './hooks/useToolbarVisibility'
import useLocalStorageState from 'use-local-storage-state'


export const SongView = () => {
    const { songDB, songData } = useLoaderData() as DataForSongView;
    const navigate = useNavigate();
    const fullScreenHandle = useFullScreenHandle();
    const viewRef = useRef<HTMLDivElement>(null);
    const {
        layout: layoutSettings,
        actions: settingsActions,
    } = useViewSettingsStore()
    const { updateVisibility } = useToolbarVisibility();
    const [transposeSteps, setTransposeSteps] = useLocalStorageState(`transposeSteps/${songData.id}`, { defaultValue: 0 });

    // Handle pinch gesture
    useGesture({
        onPinch: ({ movement: [dScale], memo }) => {
            if (!memo) memo = layoutSettings.fontSize
            const newFontSize = Math.max(8, Math.min(memo * dScale, 50))

            settingsActions.setCustomLayoutPreset({
                fitScreenMode: 'none',
            })
            settingsActions.setLayoutSettings({
                fitScreenMode: 'none',
                fontSize: newFontSize,
            })
            // settingsActions.applyPreset("custom");

            // Update toolbar visibility based on scroll position
            // TODO: this is a different state than the one used in toolbar -- does this even do anything?
            if (screen.height > 50 + document.body.scrollHeight) {
                updateVisibility(true);
            } else if (screen.height < document.body.scrollHeight && window.scrollY > 0) {
                updateVisibility(false);
            }

            return memo;
        },
    }, {
        target: viewRef,
    })

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
                navigate={navigate}
                songDB={songDB}
                songData={songData}
                fullScreenHandle={fullScreenHandle}
                originalKey={songData.key}
                transposeSteps={transposeSteps}
                setTransposeSteps={setTransposeSteps}
            />
            <FullScreen handle={fullScreenHandle} className={cn('w-full overflow-x-clip', layoutSettings.fitScreenMode == "fitXY" ? " h-full " : " h-fit overflow-y-scroll")}>
                <ScrollButtons
                    fitScreenMode={layoutSettings.fitScreenMode}
                />
                <SongContent
                    songData={songData}
                    transposeSteps={transposeSteps}
                />
            </FullScreen>
        </SongViewLayout>
    )
}

export default SongView;   