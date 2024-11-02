import { SongData } from '../../types';
import { useLoaderData, useNavigate } from "react-router-dom";
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
import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { DropdownMenu } from '@/components/ui/dropdown-menu';

function SongView() {
    const songData = useLoaderData() as SongData;
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
        const renderedSong = renderSong(songData, songRenderKey, layoutSettings.repeatParts);
        setParsedContent(renderedSong);
        scrollSpy.update();
    }, [songRenderKey, layoutSettings, songData])

    const scrollDown = () => {
        // if the rest can fit on the next screen --> scroll all the way
        const remainingContent = document.body.scrollHeight - window.scrollY - screen.height;
        console.log(remainingContent)
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
                scroll.scrollTo(rect.top - Math.max(100, 0.2 * screen.height), { duration: 2000 });
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
    return (<div className={"flex flex-col pt-20 " + (layoutSettings.fitScreenMode === "fitXY" ? " h-dvh" : "")}>
        <div className='absolute top-0'>
            <ToolbarBase>
                <LayoutSettingsToolbar layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" className="rounded-full"><Settings2 size={32} /></Button>
                    </DropdownMenuTrigger>
                    <LayoutSettingsDropdownSection layoutSettings={layoutSettings} setLayoutSettings={setLayoutSettings} />
                </DropdownMenu>
            </ToolbarBase>
        </div>
        {/* <Navbar shouldHideOnScroll maxWidth='xl' isBordered className='flex'>
            <NavbarContent justify="start">
                <Button color="primary" isIconOnly variant='ghost' onClick={() => navigate("/")}>{<Undo2 />}</Button>
            </NavbarContent>
            <NavbarContent as="div" justify="center" className='w-full max-sm:gap-2.5'>
                <NavbarItem className=''>
                    <TransposeSettings setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
                </NavbarItem>
                <NavbarItem className=''>
                    <SpaceSavingSettings chordsHidden={chordsHidden} setChordsHidden={setChordsHidden} repeatParts={repeatParts} setRepeatParts={setRepeatParts} repeatVerseChords={repeatVerseChords} setRepeatVerseChords={setRepeatVerseChords} twoColumns={twoColumns} settwoColumns={settwoColumns} />
                </NavbarItem>
                <NavbarItem className=''>
                    <FontSizeSettings fontSize={fontSize} setFontSize={setFontSize} fitScreenMode={fitScreenMode} setfitScreenMode={setfitScreenMode} />
                </NavbarItem>
                <NavbarItem className='hidden sm:flex '>
                    <Button color="primary" variant="ghost" isIconOnly href={"https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" + songData.chordproFile} as={Link}><Github /></Button>
                </NavbarItem>
            </NavbarContent >
        </Navbar > */}
        {/* https://bundui.io/docs/components/floating-button */}
        <div className={"fixed bottom-12 right-10 z-50 flex-col gap-2 " + (layoutSettings.fitScreenMode === "fitX" ? "flex" : "hidden")}>
            <Button className='' size="icon" onClick={scrollUp}><ArrowBigUpDash /></Button>
            <Button className='' size="icon" onClick={scrollDown}><ArrowBigDown /></Button>
        </div>


        <div id="auto-text-size-wrapper" className='w-full h-full'>
            <AutoTextSize
                mode={layoutSettings.fitScreenMode === "fitXY" ? "boxoneline" : "oneline"}
                minFontSizePx={layoutSettings.fitScreenMode !== "none" ? minFontSizePx : layoutSettings.fontSize}
                maxFontSizePx={layoutSettings.fitScreenMode !== "none" ? maxFontSizePx : layoutSettings.fontSize}>
                <div className={`flex flex-col ${layoutSettings.showChords ? '' : 'chords-hidden'} ${layoutSettings.repeatPartsChords ? '' : 'repeated-chords-hidden'} ${layoutSettings.twoColumns ? "song-content-columns" : ""}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song-content-wrapper" ></div>
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