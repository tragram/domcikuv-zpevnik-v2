import { SongData } from '../../types';
import { useLoaderData, useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
import { AutoTextSize } from 'auto-text-size'
import './SongView.css'
import { minFontSizePx, maxFontSizePx } from './FontSizeSettings';
// import SpaceSavingSettings from './SpaceSavingSettings';
// import TransposeSettings from './TransposeSettings';
import { renderSong, guessKey } from './songRendering';
import { Events, animateScroll as scroll, scrollSpy } from 'react-scroll';
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler, Guitar, ArrowDownFromLine, ArrowUpFromLine, ArrowBigUpDash, ArrowBigDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

type fitScreenModeType = "none" | "X" | "XY"


function SongView() {
    const songData = useLoaderData() as SongData;
    if (!songData.key) {
        songData.key = guessKey(songData.content);
    }

    const [chordsHidden, setChordsHidden] = useLocalStorageState("settings/chordsHidden", { defaultValue: false });
    const [repeatParts, setRepeatParts] = useLocalStorageState("settings/repeatParts", { defaultValue: false });
    const [repeatVerseChords, setRepeatVerseChords] = useLocalStorageState("settings/repeatVerseChords", { defaultValue: false });
    const [fontSize, setFontSize] = useLocalStorageState("settings/fontSize", { defaultValue: 12 });
    const [twoColumns, settwoColumns] = useLocalStorageState("settings/twoColumns", { defaultValue: false });
    const [fitScreenMode, setfitScreenMode] = useLocalStorageState<fitScreenModeType>("settings/fitScreenMode", { defaultValue: "XY" });

    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState(songData.key);
    const navigate = useNavigate();

    useEffect(() => {
        setParsedContent(renderSong(songData, songRenderKey, repeatParts));
        scrollSpy.update();
    }, [songRenderKey, repeatParts, songData]);

    const scrollDown = () => {
        // if the rest can fit on the next screen --> scroll all the way
        if (document.body.scrollHeight / screen.height < 1.5 || (document.body.scrollHeight - window.scrollY) < 0.8 * screen.height) {
            scroll.scrollToBottom({ duration: 3000 });
            return;
        }
        const sections = document.querySelectorAll('.section');
        // Find the next container that is not fully visible
        for (const container of sections) {
            const rect = container.getBoundingClientRect();
            // console.log(rect.bottom, window.scrollY, window.innerHeight)
            // Check if the container is not fully visible within the viewport
            if (rect.bottom >= window.scrollY + window.innerHeight) {
                // Scroll this container into view and exit the loop
                scroll.scrollTo(rect.top - Math.max(100, 0.2 * screen.height), { duration: 3000 });
                break;
            }
        }
    };
    const scrollUp = () => {
        scroll.scrollToTop({ duration: 200 });
        return;
        // console.log("scroll up")
        // if (document.body.scrollHeight / screen.height < 1.5 || window.scrollY < 0.8 * screen.height) {
        //     scroll.scrollToTop();
        //     return;
        // }
        // // Find the next container that is not fully visible
        // for (let [index, container] of Array.from(sections).reverse().entries()) {
        //     const rect = container.getBoundingClientRect();
        //     // Check if the container is not fully visible within the viewport
        //     if (rect.top <= window.scrollY) {
        //         if (index == sections.length - 1) {
        //             console.log("scroll to top")
        //             // top element
        //             scroll.scrollToTop();
        //         } else {
        //             // Scroll this container into view and exit the loop
        //             scroll.scrollTo(rect.top - Math.max(100, 0.2 * screen.height));
        //         }
        //         break;
        //     }
        // }
    };

    if (songData.lyricsLength() < 50) {
        return PdfView(songData.pdfFilenames);
    };
    return (<div className={"flex flex-col " + (fitScreenMode === "XY" ? " h-dvh" : "")}>
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
        </Navbar >
        <div className={"fixed bottom-12 right-10 z-50 flex-col gap-2 " + (fitScreenMode === "X" ? "flex" : "hidden")}>
            <Button className='' isIconOnly onPress={scrollUp}><ArrowBigUpDash /></Button>
            <Button className='' isIconOnly onPress={scrollDown}><ArrowBigDown /></Button>
        </div> */}
        {/* https://bundui.io/docs/components/floating-button */}


        <div id="auto-text-size-wrapper" className='w-full h-full'>
            <AutoTextSize
                mode={fitScreenMode === "XY" ? "boxoneline" : "oneline"}
                minFontSizePx={fitScreenMode !== "none" ? minFontSizePx : fontSize}
                maxFontSizePx={fitScreenMode !== "none" ? maxFontSizePx : fontSize}>
                <div className={`flex flex-col ${chordsHidden ? 'chords-hidden' : ''} ${repeatVerseChords ? '' : 'repeated-chords-hidden'} ${twoColumns ? "song-content-columns" : ""}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song-content-wrapper" ></div>
            </AutoTextSize>
        </div>


        {/* className={`px-6 max-h-full flex flex-grow flex-col backdrop-blur-sm bg-white/70 ${fitScreenMode === "XY" ? "overflow-hidden" : ""}`} */}
        {/* <div className='flex flex-col text-center '>
            <h1 className='text-lg font-bold'>{songData.artist} - {songData.title}</h1>
            <h2 className='opacity-70 text-sm'>Capo: {songData.capo}</h2>
        </div>
        <div className={"py-4 w-full max-h-full " + (fitScreenMode === "XY" ? "flex-1" : "")} id="autotextsize_wrapper">
        </div> */}
    </div >
    );
};

export default SongView;