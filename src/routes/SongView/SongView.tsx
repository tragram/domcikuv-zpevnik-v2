import { SongData } from '../../types';
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
import './SongView.css'
import { minFontSizePx, maxFontSizePx, LayoutSettingsToolbar, LayoutSettings, LayoutSettingsDropdownSection } from './LayoutSettings';
import { renderSong, guessKey } from './songRendering';
import { Events, animateScroll as scroll } from 'react-scroll';
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler, Guitar, ArrowDownFromLine, ArrowUpFromLine, ArrowBigUpDash, ArrowBigDown, ChevronDown, Settings2, Piano, Dices, Trash } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolbarBase from '@/components/ui/toolbar-base';
import PdfView from './pdfView';
import { Button } from '@/components/ui/button';
import { DropdownIconStart, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import TransposeSettings from './TransposeSettings';
import RandomSong, { openRandomSong, openRandomSongs, randomSongURL } from '@/components/RandomSong';
import { DataForSongView } from '@/components/song_loader';
import { ChordSettingsMenu, ChordSettingsButtons, ChordSettings } from './ChordSettingsMenu';
import { parse } from 'path';
import { ModeToggleInner } from '@/components/mode-toggle';
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGesture } from '@use-gesture/react';
import { FullScreen, useFullScreenHandle } from "react-full-screen";
import { cn } from '@/lib/utils';
import SongHeading from './SongHeading';
import { CustomAutoTextSize } from './CustomAutoTextSize';



function SongView() {

    const { songDB, songData } = useLoaderData() as DataForSongView;
    if (!songData.key) {
        songData.key = guessKey(songData.content);
    }

    const mobilePreset: LayoutSettings = {
        fitScreenMode: "fitX",
        fontSize: 12,
        repeatParts: true,
        repeatPartsChords: true,
        twoColumns: false,
        compactInFullScreen: true,
    }

    const tabletPreset: LayoutSettings = {
        fitScreenMode: "fitXY",
        fontSize: 12,
        repeatParts: false,
        repeatPartsChords: false,
        twoColumns: true,
        compactInFullScreen: false,
    }

    const [customLayoutPreset, setCustomLayoutPreset] = useLocalStorageState<LayoutSettings>("settings/SongView/CustomLayoutPreset", {
        defaultValue: window.innerWidth > 750 ? tabletPreset : mobilePreset
    });
    const [layoutSettings, setLayoutSettings] = useLocalStorageState<LayoutSettings>("settings/SongView/LayoutSettings", {
        defaultValue: customLayoutPreset
    });

    const [chordSettings, setChordSettings] = useLocalStorageState<ChordSettings>("settings/SongView/ChordSettings", {
        defaultValue: {
            showChords: true,
            czechChordNames: true,
            inlineChords: true,
        }
    });
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const [atBottom, setAtBottom] = useState(false);

    const [parsedContent, setParsedContent] = useState('');
    const [transposeSteps, setTransposeSteps] = useState(0);
    useEffect(() => {
        // avoids an annoying bug when user goes directly from one song to another, where the key stays the same
        setTransposeSteps(0);
    }, [songData.id]);

    const navigate = useNavigate();
    const fullScreenHandle = useFullScreenHandle();

    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [visibleToolbar, setVisibleToolbar] = useState(true);
    const [scrollInProgress, setscrollInProgress] = useState(false);
    const songWrapperRef = useRef(null);
    const viewRef = useRef(null);

    const handleScroll = () => {
        const currentScrollPos = window.scrollY;
        // Check if within the scrollable range
        if (currentScrollPos < 0 || currentScrollPos > document.documentElement.scrollHeight - window.innerHeight) {
            return; // Ignore elastic scroll or scroll beyond bounds (Safari...)
        }
        if (currentScrollPos > prevScrollPos) {
            if (layoutSettings.fitScreenMode != "fitXY") {
                setVisibleToolbar(false);
            }
            setPrevScrollPos(currentScrollPos);
        } else if (currentScrollPos < prevScrollPos - 10) {
            // -10 to "debounce" weird stuttering
            setVisibleToolbar(true);
            setAtBottom(false);
            setPrevScrollPos(currentScrollPos);
        }
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        if (remainingContent <= 0) {
            setAtBottom(true);
        }
    }

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll)
    })

    useMemo(() => {
        const renderedSong = renderSong(songData, transposeSteps, layoutSettings.repeatParts, chordSettings.czechChordNames);
        setParsedContent(renderedSong);
    }, [transposeSteps, layoutSettings.repeatParts, songData, chordSettings.czechChordNames])

    useEffect(() => {
    })
    const resizeObserver = new ResizeObserver((entries) => {
        setShowScrollButtons(document.body.scrollHeight > screen.height && layoutSettings.fitScreenMode != "fitXY");
    })
    resizeObserver.observe(document.body);

    const scrollDown = () => {
        if (scrollInProgress) return;
        // if the rest can fit on the next screen --> scroll all the way
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        const scrollSpeed = screen.height / 2000 // whole screen in 3s 
        if (remainingContent < 0) {
            return;
        }
        if (remainingContent < 0.8 * screen.height) {
            scroll.scrollToBottom({
                // why *10? IDK, the same scroll speed looks bad, possibly due to the easings...
                duration: remainingContent / (scrollSpeed), onComplete: () => {
                    // Trigger a tiny native scroll to hide the UI in Firefox Mobile
                    window.scrollBy(0, -1);
                }
            });
            return;
        }
        const sections = document.querySelectorAll('.section');
        // Find the next container that is not fully visible
        for (const container of sections) {
            const rect = container.getBoundingClientRect();
            // Check if the container is not fully visible within the viewport
            if (rect.bottom >= screen.height) {
                // Scroll this container into view and exit the loop
                const offset = Math.max(100, 0.2 * screen.height);
                const scrollDist = rect.top - offset;
                scroll.scrollTo(rect.top + window.scrollY - offset, { duration: scrollDist / scrollSpeed });
                break;
            }
        }
    };
    //return "scroll-down" animation is still running (even when it's scrolled down - buggy library)
    const scrollUp = () => {
        if (scrollInProgress) return;
        scroll.scrollTo(0, { duration: 200 });
    };

    if (songData.lyricsLength() < 50) {
        return PdfView(songData.pdfFilenames);
    };

    const [pinching, setPinching] = useState(false);
    const bind = useGesture({
        onPinch: ({ offset: [scale], movement: [dScale], memo }) => {

            if (!memo) memo = layoutSettings.fontSize; // Use memo to preserve initial state
            const newFontSize = Math.max(8, Math.min(memo * dScale, 50)); // Clamp between 12px and 50px
            setLayoutSettings({
                ...layoutSettings,
                fitScreenMode: "none",
                fontSize: newFontSize
            })
            setPinching(true); // Track whether pinching is active
            if (screen.height > 50 + document.body.scrollHeight) {
                setVisibleToolbar(true);
            } else if (screen.height < document.body.scrollHeight && window.scrollY > 0) {
                setVisibleToolbar(false);
            }
            return memo; // Return updated memo
        },
        onPinchEnd: () => setPinching(false),
    }, {
        target: viewRef,
    });
    const autoTextSizeProps = useMemo(() => ({
        fitMode: layoutSettings.fitScreenMode,
        minFontSizePx,
        maxFontSizePx,
        fontSize: layoutSettings.fontSize,
        setFontSize: (fontSize: number) => {
            setLayoutSettings(prev => ({
                ...prev,
                fontSize
            }));
        }
    }), [layoutSettings.fitScreenMode, layoutSettings.fontSize, setLayoutSettings]);

    // avoid default behavior on safari (hopefully both macbook and iOS)
    document.addEventListener('gesturestart', (e) => e.preventDefault())
    document.addEventListener('gesturechange', (e) => e.preventDefault())

    function BackgroundImage({ songData, id, className }) {
        return (
            <div className={cn("absolute top-0 left-0 min-h-lvh h-full w-full bg-image -z-20 blur-lg overflow-hidden  transition-all duration-1000 ease-in-out", className)} id={id} style={{ backgroundImage: `url(${songData.thumbnailURL()})` }}>
                <div className='w-full h-full bg-glass/60 dark:bg-glass/50'></div>
            </div>
        )
    }

    return (
        <div className={cn("flex flex-col sm:pt-[80px] pt-[72px] relative", layoutSettings.fitScreenMode === "fitXY" ? " h-dvh " : " min-h-dvh ")}
            ref={viewRef}
            style={{
                touchAction: 'pan-y', // Prevent default pinch-to-zoom behavior
                // userSelect: 'none',  // Prevent text selection
                // transition: 'font-size 0.2s ease',
            }}
        >
            <BackgroundImage songData={songData} id="outer-background-image" />
            <div className='absolute top-0'>
                <ToolbarBase showToolbar={visibleToolbar}>
                    <Button size="icon" variant="circular" onClick={() => navigate("/")}>{<Undo2 />}</Button>
                    <ChordSettingsButtons chordSettings={chordSettings} setChordSettings={setChordSettings} />
                    <LayoutSettingsToolbar layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} customLayoutPreset={customLayoutPreset} setCustomLayoutPreset={setCustomLayoutPreset} fullScreenHandle={fullScreenHandle} />
                    <TransposeSettings songOriginalKey={songData.key} transposeSteps={transposeSteps} setTransposeSteps={setTransposeSteps} />
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="circular"><Settings2 size={32} /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 max-h-[80vh] overflow-y-scroll">
                            {React.Children.toArray(<LayoutSettingsDropdownSection layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} customLayoutPreset={customLayoutPreset} setCustomLayoutPreset={setCustomLayoutPreset} fullScreenHandle={fullScreenHandle} />)}
                            {React.Children.toArray(<ChordSettingsMenu chordSettings={chordSettings} setChordSettings={setChordSettings} />)}
                            <DropdownMenuLabel>Theme</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {React.Children.toArray(<ModeToggleInner />)}
                            <DropdownMenuLabel>Misc</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <DropdownIconStart icon={<Github />} />
                                <Link
                                    to={"https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" + songData.chordproFile}>
                                    Edit on GitHub
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <DropdownIconStart icon={<Dices />} />
                                <Link
                                    to={randomSongURL(songDB.songs)} >
                                    Show random song
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className='max-xs:hidden'>
                        <RandomSong songs={songDB.songs} />
                    </div>
                </ToolbarBase>
            </div>
            <div className={cn("fixed bottom-10 right-10 z-50 h-24 ", showScrollButtons ? "flex" : "hidden")}>
                <Button className={cn('absolute top-0 right-0 ', atBottom ? "flex" : "hidden")} size="icon" variant="circular" onClick={scrollUp}><ArrowBigUpDash /></Button>
                <Button className={cn('absolute bottom-0 right-0 ', atBottom ? "hidden" : "flex")} size="icon" variant="circular" onClick={scrollDown}><ArrowBigDown /></Button>
            </div>
            <FullScreen handle={fullScreenHandle} className={cn('w-full overflow-x-clip', layoutSettings.fitScreenMode == "fitXY" ? " h-full " : " h-fit overflow-y-scroll")}>
                <BackgroundImage songData={songData} className="hidden" id="inner-background-image" />
                <div id="auto-text-size-wrapper" className={cn('w-full z-10 lg:px-16 p-4 sm:p-8', layoutSettings.fitScreenMode == "fitXY" ? "h-full " : "h-fit ", layoutSettings.fitScreenMode !== "fitXY" ? "mb-10" : "")}
                >
                    <CustomAutoTextSize
                        {...autoTextSizeProps}>
                        <SongHeading songData={songData} layoutSettings={layoutSettings} transposeSteps={transposeSteps} />
                        <div className={cn("flex flex-col max-w-screen",
                            chordSettings.inlineChords ? ' chords-inline ' : ' ',
                            chordSettings.showChords ? '' : ' chords-hidden ',
                            `fit-screen-${layoutSettings.fitScreenMode}`,
                            layoutSettings.repeatPartsChords ? '' : ' repeated-chords-hidden ',
                            layoutSettings.twoColumns ? " song-content-columns " : "")}
                            dangerouslySetInnerHTML={{ __html: parsedContent }} id="song-content-wrapper"
                            ref={songWrapperRef}>
                        </div>
                    </CustomAutoTextSize>
                </div>
            </FullScreen>
        </div >
    );
};

export default SongView;