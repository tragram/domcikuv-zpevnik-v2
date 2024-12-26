
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLoaderData } from 'react-router-dom'
import { useFullScreenHandle } from 'react-full-screen'
import { useGesture } from '@use-gesture/react'
import { cn } from '@/lib/utils'
import { renderSong, guessKey } from './songRendering'
import { DataForSongView } from '@/components/song_loader'
import { Toolbar } from './settings/Toolbar'
import PdfView from './pdfView'
import { useViewSettingsStore } from './hooks/viewSettingsStore'
import { SongViewLayout } from './components/SongViewLayout'
import { SongContent } from './components/SongContent'
import { FullScreen, FullScreenHandle } from 'react-full-screen'
import ScrollButtons from './components/ScrollButtons'
import './SongView.css'
import { useScrollHandler } from './hooks/useScrollHandler'

export const SongView = () => {
    const { songDB, songData } = useLoaderData() as DataForSongView
    const navigate = useNavigate()
    const fullScreenHandle = useFullScreenHandle()
    const viewRef = useRef<HTMLDivElement>(null)
    const songWrapperRef = useRef<HTMLDivElement>(null)
    const {
        layout: layoutSettings,
        chords: chordSettings,
        transpose: transposeSettings,
        actions: settingsActions,
    } = useViewSettingsStore()

    const [visibleToolbar, setVisibleToolbar] = useState(true);
    const [parsedContent, setParsedContent] = useState("");
    const { atBottom } = useScrollHandler(layoutSettings.fitScreenMode, setVisibleToolbar);

    // Initialize song key if not present
    useEffect(() => {
        if (!songData.key) {
            songData.key = guessKey(songData.content || '')
        }
        settingsActions.setOriginalKey(songData.key || null);
    }, [songData, settingsActions]);

    // avoids an annoying bug when user goes directly from one song to another, where the key stays the same
    useEffect(() => {
        settingsActions.resetTranspose();
    }, [songData.id, settingsActions])

    // Update parsed content when relevant dependencies change
    useEffect(() => {
        const renderedSong = renderSong(
            songData,
            transposeSettings.steps,
            layoutSettings.repeatParts,
            chordSettings.czechChordNames
        )
        setParsedContent(renderedSong)
    }, [
        transposeSettings,
        layoutSettings.repeatParts,
        songData,
        chordSettings.czechChordNames,
        settingsActions,
    ])

    // Handle pinch gesture
    const bind = useGesture({
        onPinch: ({ offset: [scale], movement: [dScale], memo }) => {
            if (!memo) memo = layoutSettings.fontSize
            const newFontSize = Math.max(8, Math.min(memo * dScale, 50))

            settingsActions.setLayoutSettings({
                fitScreenMode: 'none',
                fontSize: newFontSize,
            })

            // Update toolbar visibility based on scroll position
            if (screen.height > 50 + document.body.scrollHeight) {
                setVisibleToolbar(true)
            } else if (screen.height < document.body.scrollHeight && window.scrollY > 0) {
                setVisibleToolbar(false)
            }

            return memo
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
            songData={songData}
        >
            <Toolbar
                visible={visibleToolbar}
                navigate={navigate}
                songDB={songDB}
                songData={songData}
                fullScreenHandle={fullScreenHandle}
            />
            <FullScreen handle={fullScreenHandle} className={cn('w-full overflow-x-clip', layoutSettings.fitScreenMode == "fitXY" ? " h-full " : " h-fit overflow-y-scroll")}>
                <ScrollButtons
                    fitScreenMode={layoutSettings.fitScreenMode}
                    setVisibleToolbar={setVisibleToolbar}
                    atBottom={atBottom}
                />
                <SongContent
                    ref={songWrapperRef}
                    songData={songData}
                    parsedContent={parsedContent}
                />
            </FullScreen>
        </SongViewLayout>
    )
}

export default SongView;   