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
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler, Guitar, ArrowDownFromLine, ArrowUpFromLine, ArrowBigUpDash, ArrowBigDown, ChevronDown, Settings2 } from 'lucide-react';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import ToolbarBase from '@/components/ui/toolbar-base';
import PdfView from './pdfView';
import { Button } from '@/components/ui/button';
import { DropdownIconStart, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import TransposeSettings from './TransposeSettings';
import RandomSong from '@/components/RandomSong';
import { DataForSongView } from '@/components/song_loader';

function SongView() {
    const { songDB, songData } = useLoaderData() as DataForSongView;
    if (!songData.key) {
        songData.key = guessKey(songData.content);
    }

    const [layoutSettings, setLayoutSettings] = useLocalStorageState<LayoutSettings>("settings/viewLayoutSettings", {
        defaultValue: {
            fitScreenMode: "fitXY",
            fontSize: 12,
            showChords: true,
            repeatParts: false,
            repeatPartsChords: false,
            twoColumns: false,
        }
    });

    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState(songData.key);
    const navigate = useNavigate();

    useMemo(() => {
        console.log(songRenderKey)
        const renderedSong = renderSong(songData, songRenderKey, layoutSettings.repeatParts);
        setParsedContent(renderedSong);
        scrollSpy.update();
    }, [songRenderKey, layoutSettings.repeatParts, songData])

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


    return (<div className={"flex flex-col pt-20 " + (layoutSettings.fitScreenMode === "fitXY" ? " h-dvh" : "")}
    >
        <div className='absolute top-0 left-0 h-full w-full bg-image -z-20 blur-md' style={{ backgroundImage: `url(${songData.thumbnailURL()})` }}></div>
        <div className='absolute top-0'>
            <ToolbarBase>
                <Button size="icon" onClick={() => navigate("/")}>{<Undo2 />}</Button>
                <LayoutSettingsToolbar layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} />
                <TransposeSettings songRenderKey={songRenderKey} setSongRenderKey={setSongRenderKey} />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" className="rounded-full"><Settings2 size={32} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                        {React.Children.toArray(<LayoutSettingsDropdownSection layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} />)}
                        <DropdownMenuSeparator />
                        <DropdownMenuSeparator />
                        {/* <DropdownMenuLabel>Results settings</DropdownMenuLabel>
                        <DropdownMenuSeparator /> */}
                        <DropdownMenuItem>
                            <DropdownIconStart icon={<Github />} />

                            <Link
                                to={"https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" + songData.chordproFile}>
                                Edit on GitHub
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <RandomSong songs={songDB.songs} />
            </ToolbarBase>
        </div>
        {/* https://bundui.io/docs/components/floating-button */}
        <div className={"fixed bottom-12 right-10 z-50 flex-col gap-2 " + (layoutSettings.fitScreenMode === "fitX" ? "flex" : "hidden")}>
            <Button className='' size="icon" onClick={scrollUp}><ArrowBigUpDash /></Button>
            <Button className='' size="icon" onClick={scrollDown}><ArrowBigDown /></Button>
        </div>

        <div className='h-12 self-center items-center flex bg-white/70 backdrop-blur-md mb-2 justify-between container px-20'>
            <h2 className='text-sm text-nowrap'>Capo: {songData.capo}</h2>
            <h1 className='self-center font-bold text-nowrap'>{songData.artist} - {songData.title}</h1>
            <h2 className='text-sm text-nowrap'>Range: {songData.range.min}-{songData.range.max}</h2>
        </div>


        <div id="auto-text-size-wrapper" className={'w-full z-10 md:p-8 p-4' + (layoutSettings.fitScreenMode == "fitXY" ? " h-[calc(100%-3rem)] " : " h-fit ")}>
            <AutoTextSize
                mode={layoutSettings.fitScreenMode === "fitXY" ? "boxoneline" : "oneline"}
                minFontSizePx={layoutSettings.fitScreenMode !== "none" ? minFontSizePx : layoutSettings.fontSize}
                maxFontSizePx={layoutSettings.fitScreenMode !== "none" ? maxFontSizePx : layoutSettings.fontSize}>
                <div className={`flex flex-col  ${layoutSettings.showChords ? '' : 'chords-hidden'} ${layoutSettings.repeatPartsChords ? '' : 'repeated-chords-hidden'} ${layoutSettings.twoColumns ? "song-content-columns" : ""}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song-content-wrapper" ></div>
            </AutoTextSize>
        </div>


        {/* className={`px-6 max-h-full flex flex-grow flex-col backdrop-blur-sm bg-white/70 ${layoutSettings.fitScreenMode === "XY" ? "overflow-hidden" : ""}`} */}
        {/* <div className='flex flex-col text-center '>
            <h1 className='text-lg font-bold'>{songData.artist} - {songData.title}</h1>
            <h2 className='opacity-70 text-sm'>Capo: {songData.capo}</h2>
        </div>
        <div className={"py-4 w-full max-h-full " + (layoutSettings.fitScreenMode === "XY" ? "flex-1" : "")} id="autotextsize_wrapper">
        </div> */}
    </div >
    );
};

export default SongView;