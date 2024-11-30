import { SongData } from '../../types';
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
import { AutoTextSize } from 'auto-text-size'
import './SongView.css'
import { minFontSizePx, maxFontSizePx, LayoutSettingsToolbar, LayoutSettings, LayoutSettingsDropdownSection } from './LayoutSettings';
import { renderSong, guessKey } from './songRendering';
import { Events, animateScroll as scroll } from 'react-scroll';
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler, Guitar, ArrowDownFromLine, ArrowUpFromLine, ArrowBigUpDash, ArrowBigDown, ChevronDown, Settings2, Piano, Dices, Trash } from 'lucide-react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
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



function SongView() {
    const { songDB, songData } = useLoaderData() as DataForSongView;
    if (!songData.key) {
        songData.key = guessKey(songData.content);
    }

    const mobilePreset = {
        fitScreenMode: "fitX",
        fontSize: 12,
        repeatParts: true,
        repeatPartsChords: true,
        twoColumns: false,
    }

    const tabletPreset = {
        fitScreenMode: "fitXY",
        fontSize: 12,
        repeatParts: false,
        repeatPartsChords: false,
        twoColumns: true,
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

    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [visibleToolbar, setVisibleToolbar] = useState(true);
    const [scrollInProgress, setscrollInProgress] = useState(false);

    const handleScroll = () => {
        const currentScrollPos = window.scrollY
        if (currentScrollPos > prevScrollPos) {
            setVisibleToolbar(false)
            setPrevScrollPos(currentScrollPos);
        } else if (currentScrollPos < prevScrollPos - 10) {
            // -10 to "debounce" weird stuttering
            setVisibleToolbar(true)
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

    // react-scroll is buggy, so this is an ugly work-around (no way to cancel animation directly)
    useEffect(() => {
        // Registering the 'begin' event and logging it to the console when triggered.
        Events.scrollEvent.register('begin', () => {
            setscrollInProgress(true);
        });

        // Registering the 'end' event and logging it to the console when triggered.
        Events.scrollEvent.register('end', () => {
            setscrollInProgress(false);
        });

        // Returning a cleanup function to remove the registered events when the component unmounts.
        return () => {
            Events.scrollEvent.remove('begin');
            Events.scrollEvent.remove('end');
        };
    }, []);

    useMemo(() => {
        const renderedSong = renderSong(songData, transposeSteps, layoutSettings.repeatParts, chordSettings.czechChordNames);
        setParsedContent(renderedSong);
    }, [transposeSteps, layoutSettings.repeatParts, songData, chordSettings.czechChordNames])

    useEffect(() => {
    })
    const resizeObserver = new ResizeObserver((entries) => {
        setShowScrollButtons(document.body.scrollHeight > screen.height && layoutSettings.fitScreenMode === "fitX");
    })
    resizeObserver.observe(document.body);

    const scrollDown = () => {
        if (scrollInProgress) return;
        // if the rest can fit on the next screen --> scroll all the way
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        const scrollSpeed = screen.height / 3000 // whole screen in 3s 
        if (remainingContent < 0) {
            return;
        }
        if (remainingContent < 0.8 * screen.height) {
            scroll.scrollToBottom({
                // why *10? IDK, the same scroll speed looks bad, possibly due to the easings...
                duration: remainingContent / scrollSpeed * 10, onComplete: () => {
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
                console.log("duration: ", scrollDist / scrollSpeed)
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

    function formatChords(data) {
        return data.split(/(\d|[#b])/).map((part, index) => {
            if (/\d/.test(part)) {
                return <sub key={index}>{part}</sub>; // Render numbers as superscripts
            } else if (/[#b]/.test(part)) {
                return <sup key={index}>{part}</sup>; // Render # or b as superscripts
            }
            return part; // Render other parts as plain text
        });
    }

    return (
        <div className={"flex flex-col relative" + (layoutSettings.fitScreenMode === "fitXY" ? " h-dvh" : " min-h-dvh") + (visibleToolbar || layoutSettings.fitScreenMode != "fitXY" ? " sm:pt-[80px] pt-[72px]" : "")}
        >
            <div className='absolute top-0 left-0 h-full w-full bg-image -z-20 blur-lg overflow-hidden' style={{ backgroundImage: `url(${songData.thumbnailURL()})` }}>
                <div className='w-full h-full bg-glass/60 dark:bg-glass/50'></div>
            </div>
            <div className='absolute top-0'>
                <ToolbarBase showToolbar={visibleToolbar}>
                    <Button size="icon" variant="circular" onClick={() => navigate("/")}>{<Undo2 />}</Button>
                    <ChordSettingsButtons chordSettings={chordSettings} setChordSettings={setChordSettings} />
                    <LayoutSettingsToolbar layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} customLayoutPreset={customLayoutPreset} setCustomLayoutPreset={setCustomLayoutPreset} />
                    <TransposeSettings songOriginalKey={songData.key} transposeSteps={transposeSteps} setTransposeSteps={setTransposeSteps} />
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="circular"><Settings2 size={32} /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 max-h-[80vh] overflow-y-scroll">
                            {React.Children.toArray(<LayoutSettingsDropdownSection layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} customLayoutPreset={customLayoutPreset} setCustomLayoutPreset={setCustomLayoutPreset} />)}
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
            <div className={"fixed bottom-10 right-10 z-50 h-24 " + (showScrollButtons ? "flex" : "hidden")}>
                <Button className={'absolute top-0 right-0 ' + (atBottom ? "flex" : "hidden")} size="icon" variant="circular" onClick={scrollUp}><ArrowBigUpDash /></Button>
                <Button className={'absolute bottom-0 right-0 ' + (atBottom ? "hidden" : "flex")} size="icon" variant="circular" onClick={scrollDown}><ArrowBigDown /></Button>
            </div>

            <div id="auto-text-size-wrapper" className={'w-full z-10 lg:p-16 p-4 sm:p-8' + (layoutSettings.fitScreenMode == "fitXY" ? " h-full " : " h-fit ") + (layoutSettings.fitScreenMode === "fitX" ? " mb-8" : "")}>
                <AutoTextSize
                    mode={layoutSettings.fitScreenMode === "fitXY" ? "boxoneline" : "oneline"}
                    minFontSizePx={layoutSettings.fitScreenMode !== "none" ? minFontSizePx : layoutSettings.fontSize}
                    maxFontSizePx={layoutSettings.fitScreenMode !== "none" ? maxFontSizePx : layoutSettings.fontSize}>
                    <div className='flex w-full justify-between gap-2'>
                        {layoutSettings.fitScreenMode === "fitXY" ?
                            <h1 className='self-center font-bold text-nowrap mb-2'>{songData.artist}: {songData.title}</h1>
                            :
                            <div className='flex flex-col justify-start mb-4'>
                                <h2 className='font-medium text-nowrap uppercase'>{songData.artist}</h2>
                                <h2 className='font-bold text-nowrap'>{songData.title}</h2>
                            </div>}
                        <div className='flex flex-col text-right'>
                            <h2 className='text-[0.75em] text-muted-foreground text-nowrap'>Capo: {(songData.capo - transposeSteps + 12) % 12}</h2>
                            <h2 className='text-[0.75em] text-muted-foreground sub-sup-container'>{formatChords(songData.range.toString(transposeSteps))}</h2>
                        </div>
                    </div>
                    <div className={`flex flex-col max-w-screen overflow-clip 
                    ${chordSettings.inlineChords ? ' chords-inline ' : ' '}
                    ${chordSettings.showChords ? '' : ' chords-hidden '}
                    fit-screen-${layoutSettings.fitScreenMode}
                    ${layoutSettings.repeatPartsChords ? '' : ' repeated-chords-hidden '}
                    ${layoutSettings.twoColumns ? " song-content-columns " : ""}`}
                        dangerouslySetInnerHTML={{ __html: parsedContent }} id="song-content-wrapper">
                        </div>
                </AutoTextSize>
            </div>
        </div >
    );
};

export default SongView;