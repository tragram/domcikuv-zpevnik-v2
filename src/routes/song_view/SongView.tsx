'use client'
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, RadioGroup, Radio, ButtonGroup, Navbar, NavbarContent, NavbarMenuToggle, Link, NavbarItem, NavbarMenu, NavbarMenuItem, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
// import SongRange from "./songs_list"
import { useMediaQuery } from "@uidotdev/usehooks";
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler, Guitar } from 'lucide-react';
import { HashRouter, Route, Routes, useLoaderData } from "react-router-dom";
import { SongData } from '../../types';
import { useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
import { AutoTextSize } from 'auto-text-size'
import { FontSizeSettings, minFontSizePx, maxFontSizePx } from './FontSizeSettings';
import SpaceSavingSettings from './SpaceSavingSettings';
import TransposeSettings from './TransposeSettings';
import { renderSong, guessKey } from './song_rendering';

const PdfView = ({ pdfFilenames }: { pdfFilenames: string[] }) => (
    // {/* the last PDF is the smallest filesize (they are ordered as scan > compressed > gen (if it exists)) */}
    <iframe src={pdfFilenames.slice(-1)[0]} className='w-screen h-screen' />
);

function SongView({ }) {
    let songData = useLoaderData() as SongData;

    if (!songData.key) {
        songData.key = guessKey(songData.content);
    }
    if (songData.lyricsLength() < 50) {
        return PdfView(songData.pdfFilenames);
    };
    const [chordsHidden, setChordsHidden] = useLocalStorageState("settings/chordsHidden", { defaultValue: false });
    const [repeatChorus, setRepeatChorus] = useLocalStorageState("settings/repeatChorus", { defaultValue: true });
    const [repeatVerseChords, setRepeatVerseChords] = useLocalStorageState("settings/repeatVerseChords", { defaultValue: true });
    const [fontSize, setFontSize] = useLocalStorageState("settings/fontSize", { defaultValue: 12 });
    const [autoFontSize, setAutoFontSize] = useLocalStorageState("settings/autoFontSize", { defaultValue: true });

    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState(songData.key);
    let navigate = useNavigate();


    useEffect(() => {
        setParsedContent(renderSong(songData, songRenderKey, repeatChorus));
    }, [songRenderKey, repeatChorus]);

    // const fullScreen = useMediaQuery(
    //     "only screen and (max-width : 600px)"
    // );

    return (<div className={`h-screen w-screen ${autoFontSize ? "overflow-hidden" : ""}`}>
        <Navbar shouldHideOnScroll maxWidth='xl' isBordered className='flex'>
            <NavbarContent justify="start">
                <Button color="primary" isIconOnly variant='ghost' onClick={() => navigate("/")}>{<Undo2 />}</Button>
            </NavbarContent>
            <NavbarContent as="div" justify="center" className='w-full max-sm:gap-2.5'>
                <NavbarItem className=''>
                    <TransposeSettings setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
                </NavbarItem>
                <NavbarItem className=''>
                    <SpaceSavingSettings chordsHidden={chordsHidden} setChordsHidden={setChordsHidden} repeatChorus={repeatChorus} setRepeatChorus={setRepeatChorus} repeatVerseChords={repeatVerseChords} setRepeatVerseChords={setRepeatVerseChords} />
                </NavbarItem>
                <NavbarItem className=''>
                    <FontSizeSettings fontSize={fontSize} setFontSize={setFontSize} autoFontSize={autoFontSize} setAutoFontSize={setAutoFontSize} />
                </NavbarItem>
                <NavbarItem className='hidden sm:flex'>
                    <Button color="primary" variant="ghost" isIconOnly href={"https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" + songData.chordproFile} as={Link}><Github /></Button>
                </NavbarItem>
            </NavbarContent >
        </Navbar >
        <div className={`px-6 ${autoFontSize ? "overflow-hidden" : ""}`} style={{ height: 'calc(100% - 4rem)' }}>
            <div className='flex flex-col text-center '>
                <h1 className='text-lg font-bold'>{songData.artist} - {songData.title}</h1>
                <h2 className='opacity-70 text-sm'>Capo: {songData.capo}</h2>
            </div>
            <div className={`${autoFontSize ? "overflow-hidden flex-1" : ""} pb-4 w-full justify-center`} style={{ height: 'calc(100% - 4rem)' }}>
                <AutoTextSize mode="boxoneline" minFontSizePx={autoFontSize ? minFontSizePx : fontSize} maxFontSizePx={autoFontSize ? maxFontSizePx : fontSize}>
                    <div className={`m-auto  ${chordsHidden ? 'chords-hidden' : ''} ${repeatVerseChords ? '' : 'repeat-verse-chords-hidden'}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content" ></div>
                </AutoTextSize>
            </div>
        </div>
    </div>
    );
};

export default SongView;