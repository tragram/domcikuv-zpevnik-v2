import { SongData } from '../../types';
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
import { AutoTextSize } from 'auto-text-size'
import './SongView.css'
import { minFontSizePx, maxFontSizePx, LayoutSettingsToolbar, LayoutSettings, LayoutSettingsDropdownSection } from './LayoutSettings';
// import SpaceSavingSettings from './SpaceSavingSettings';
// import TransposeSettings from './TransposeSettings';
import { renderSong, guessKey } from './songRendering';
import { Events, animateScroll as scroll, scrollSpy } from 'react-scroll';
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler, Guitar, ArrowDownFromLine, ArrowUpFromLine, ArrowBigUpDash, ArrowBigDown, ChevronDown, Settings2, Piano, Dices } from 'lucide-react';
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

    const [layoutSettings, setLayoutSettings] = useLocalStorageState<LayoutSettings>("settings/SongView/LayoutSettings", {
        defaultValue: {
            fitScreenMode: "fitXY",
            fontSize: 12,
            repeatParts: false,
            repeatPartsChords: false,
            twoColumns: false,
        }
    });

    const [chordSettings, setChordSettings] = useLocalStorageState<ChordSettings>("settings/SongView/ChordSettings", {
        defaultValue: {
            showChords: true,
            czechChordNames: true,
            inlineChords: true,
        }
    });
    const [showScrollButtons, setShowScrollButtons] = useState(false);


    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState(songData.key);
    const navigate = useNavigate();

    const [prevScrollPos, setPrevScrollPos] = useState(0);
    const [visibleToolbar, setVisibleToolbar] = useState(true)

    const handleScroll = () => {
        const currentScrollPos = window.scrollY

        if (currentScrollPos > prevScrollPos) {
            setVisibleToolbar(false)
            setPrevScrollPos(currentScrollPos);
        } else if (currentScrollPos < prevScrollPos - 10) {
            // -10 to "debounce" weird stuttering
            setVisibleToolbar(true)
            setPrevScrollPos(currentScrollPos);
        }
    }

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll)
    })


    useMemo(() => {
        const renderedSong = renderSong(songData, songRenderKey, layoutSettings.repeatParts, chordSettings.czechChordNames);
        setParsedContent(renderedSong);
        scrollSpy.update();
    }, [songRenderKey, layoutSettings.repeatParts, songData, chordSettings.czechChordNames])

    useEffect(() => {
    })
    const resizeObserver = new ResizeObserver((entries) => {
        setShowScrollButtons(document.body.scrollHeight > screen.height && layoutSettings.fitScreenMode === "fitX");
    })
    resizeObserver.observe(document.body);

    const scrollDown = () => {
        // if the rest can fit on the next screen --> scroll all the way
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        if (remainingContent < 0.8 * screen.height) {
            scroll.scrollToBottom({ duration: 3000 });
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
                scroll.scrollTo(rect.top + window.scrollY - offset, { duration: 2000 });
                break;
            }
        }
    };
    const scrollUp = () => {
        scroll.scrollToTop({ duration: 200 });
        return;
    };

    if (songData.lyricsLength() < 50) {
        return PdfView(songData.pdfFilenames);
    };
    return (<div className={"flex flex-col sm:pt-[88px] pt-[72px] " + (layoutSettings.fitScreenMode === "fitXY" ? " h-dvh" : "")}
    >
        <div className='absolute top-0 left-0 h-full w-full bg-image -z-20 blur-md' style={{ backgroundImage: `url(${songData.thumbnailURL()})` }}></div>
        <div className='absolute top-0'>
            <ToolbarBase showToolbar={visibleToolbar}>
                <Button size="icon" variant="circular" onClick={() => navigate("/")}>{<Undo2 />}</Button>
                <ChordSettingsButtons chordSettings={chordSettings} setChordSettings={setChordSettings} />
                <LayoutSettingsToolbar layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} />
                <TransposeSettings songRenderKey={songRenderKey} setSongRenderKey={setSongRenderKey} />
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="circular"><Settings2 size={32} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 max-h-[80vh] overflow-y-scroll">
                        {React.Children.toArray(<LayoutSettingsDropdownSection layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} />)}
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
                <div className='max-sm:hidden'>
                    <RandomSong songs={songDB.songs} />
                </div>
            </ToolbarBase>
        </div>
        {/* https://bundui.io/docs/components/floating-button */}
        <div className={"fixed bottom-12 right-10 z-50 flex-col gap-3 " + (showScrollButtons ? "flex" : "hidden")}>
            <Button className='' size="icon" variant="circular" onClick={scrollUp}><ArrowBigUpDash /></Button>
            <Button className='' size="icon" variant="circular" onClick={scrollDown}><ArrowBigDown /></Button>
        </div>


        <div id="auto-text-size-wrapper" className={'w-full z-10 md:p-8 p-2 sm:p-4' + (layoutSettings.fitScreenMode == "fitXY" ? " h-full " : " h-fit ")}>
            <AutoTextSize
                mode={layoutSettings.fitScreenMode === "fitXY" ? "boxoneline" : "oneline"}
                minFontSizePx={layoutSettings.fitScreenMode !== "none" ? minFontSizePx : layoutSettings.fontSize}
                maxFontSizePx={layoutSettings.fitScreenMode !== "none" ? maxFontSizePx : layoutSettings.fontSize}>
                <div className='absolute h-12 self-center items-center flex bg-glass/70 backdrop-blur-md mb-2 justify-between'>
                    {/* <h2 className='text-sm text-nowrap'>Capo: {songData.capo}</h2> */}
                    {/* <h2 className='text-sm text-nowrap'>Range: {songData.range.min}-{songData.range.max}</h2> */}
                </div>
                <h1 className='self-center font-bold text-sm text-nowrap mb-2'>{songData.artist}: {songData.title}</h1>
                <div className={`flex flex-col 
                    ${chordSettings.inlineChords ? ' chords-inline ' : ' '}
                    ${chordSettings.showChords ? '' : ' chords-hidden '}
                    ${layoutSettings.repeatPartsChords ? '' : ' repeated-chords-hidden '}
                    ${layoutSettings.twoColumns ? " song-content-columns " : ""}`}
                    dangerouslySetInnerHTML={{ __html: parsedContent }} id="song-content-wrapper" ></div>
            </AutoTextSize>
        </div>
    </div >
    );
};

export default SongView;