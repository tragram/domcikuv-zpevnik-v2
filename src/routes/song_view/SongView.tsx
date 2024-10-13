'use client'
import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, RadioGroup, Radio, ButtonGroup } from "@nextui-org/react";
import ChordSheetJS from 'chordsheetjs';
// import SongRange from "./songs_list"
import { useMediaQuery } from "@uidotdev/usehooks";
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText } from 'lucide-react';
import { HashRouter, Route, Routes, Link, useLoaderData } from "react-router-dom";
import { SongData } from '../../types';

const chromaticScale = {
    "c": 0,
    "c#": 1,
    "db": 1,
    "des": 1,
    "d": 2,
    "d#": 3,
    "eb": 3,
    "es": 3,
    "e": 4,
    "f": 5,
    "f#": 6,
    "gb": 6,
    "g": 7,
    "g#": 8,
    "ab": 8,
    "as": 8,
    "a": 9,
    "a#": 10,
    // "bb": 10,
    "b": 10,
    "h": 11
};

const renderKeys = ["C", "C#", "D", "Es", "E", "F", "F#", "G", "As", "A", "B", "H"]

function replaceChorusDirective(song, repeatChorus) {
    // ChordSheetJS doesn't know the {chorus} directive but I want to use it
    const lines = song.split("\n");
    let currentChorus = "";
    let inChorus = false;
    let processedLines = [];

    lines.forEach(line => {
        // Detect start of chorus
        if (line.trim() === "{start_of_chorus}") {
            inChorus = true;
            currentChorus = "{start_of_chorus}\n"; // Reset the chorus
            return;
        }

        // Detect end of chorus
        if (line.trim() === "{end_of_chorus}") {
            inChorus = false;
            processedLines.push(currentChorus.trim()); // Push the chorus immediately
            currentChorus += "{end_of_chorus}"; // End the chorus with the marker
            return;
        }

        // Store chorus lines
        if (inChorus) {
            currentChorus += line + "\n";
            return;
        }

        // Replace {chorus} with the last defined chorus
        if (line.trim() === "{chorus}") {
            if (repeatChorus) { processedLines.push(currentChorus.trim()); }
            else {
                processedLines.push("{start_of_chorus}R:{end_of_chorus}");
            }
        } else {
            processedLines.push(line);
        }
    });

    return processedLines.join("\n");
}

function TransposeButtons({ songData, songRenderKey, setSongRenderKey }) {
    function getKeyIndex(key) {
        return renderKeys.map(x => x.toLowerCase()).indexOf(key.toLowerCase());
    }
    return (<>
        <div className='hidden lg:flex'>
            <ButtonGroup>
                {renderKeys.map((chord) => (
                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                        name="transpose_selection" onClick={() => { setSongRenderKey(chord) }} variant={songRenderKey && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                ))
                }
            </ButtonGroup>
        </div>
        <div className='lg:hidden'>
            <ButtonGroup>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(renderKeys[(getKeyIndex(songRenderKey) + 11) % 12])} variant='ghost'>-</Button>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(renderKeys[(getKeyIndex(songRenderKey) + 1) % 12])} variant='ghost'>+</Button>
            </ButtonGroup>
        </div>
    </>)
}


function SongView({ }) {
    const songData = useLoaderData() as SongData;
    const songContent = songData.content;
    if (songData.lyricsLength() < 50) {
        return (
            <div >
                <iframe src={songData.pdfFilenames.slice(-1)} className='w-screen h-screen'/>
            </div>
        );
    };
    // useEffect(() => {
    //     console.log(songData.content, songData.lyricsLength())
    //     // if (!songContent) {
    //     //     fetch(import.meta.env.BASE_URL + "/songs/chordpro/" + songData.chordproFile)
    //     //         .then(response => response.json())
    //     //         // 4. Setting *dogImage* to the image url that we received from the response above
    //     //         .then(data => setSongContent(data));
    //     // } else {
    //     //     setSongContent(songContent);
    //     // }
    // }, [])

    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState('');
    const [chordsHidden, setChordsHidden] = useState(false);
    const [repeatChorus, setRepeatChorus] = useState(true);
    const [repeatVerseChords, setRepeatVerseChords] = useState(true);
    const [fontSize, setFontSize] = useState(2);
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();

    function renderSong(key) {
        let song = replaceChorusDirective(songData.content, repeatChorus);
        song = parser.parse(song);
        let difference = chromaticScale[key.toLowerCase()] - chromaticScale[songData.key.toLowerCase()] + 1 * song.capo; // using capo in chordpro is not just a comment but actually modifies the chords... 
        song = song.transpose(difference)
        const renderedSong = formatter.format(song);
        setParsedContent(renderedSong);
    }

    // useEffect(() => {
    //     // if (!song) {
    //     //     return;
    //     // }
    //     renderSong(songRenderKey);
    // }, [songContent, songRenderKey, repeatChorus]);

    const fullScreen = useMediaQuery(
        "only screen and (max-width : 600px)"
    );
    const fontSizeStep = 0.2;
    return (<>
        <TransposeButtons songData={songData} setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
        <div className={`${chordsHidden ? 'chords-hidden' : ''} ${repeatVerseChords ? '' : 'repeat-verse-chords-hidden'}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content" style={{ fontSize: `${fontSize}vh` }}></div>
        <ButtonGroup>
            <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize - fontSizeStep) }} variant="ghost"><AArrowDown /></Button>
            <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize + fontSizeStep) }} variant="ghost"><AArrowUp /></Button>
            <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "solid" : "ghost"}><Strikethrough /></Button>
            <Button color="primary" isIconOnly onClick={() => { setRepeatChorus(!repeatChorus) }} variant={repeatChorus ? "solid" : "ghost"}><Repeat /></Button>
            <Button color="primary" isIconOnly onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} variant={repeatVerseChords ? "solid" : "ghost"}><ReceiptText /></Button>

        </ButtonGroup>

        {/* <Modal disableAnimation
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            scrollBehavior={scrollBehavior}
            size={fullScreen ? "full" : "xl"}
        ><ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            {songData && songData.artist}: {songData && songData.title}
                        </ModalHeader>
                        <ModalBody>
                            <TransposeButtons songData={songData} setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
                            <div className={`${chordsHidden ? 'chords-hidden' : ''} ${repeatVerseChords ? '' : 'repeat-verse-chords-hidden'}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content" style={{ fontSize: `${fontSize}vh` }}></div>
                        </ModalBody>
                        <ModalFooter className="flex flex-col">
                            <ButtonGroup>
                                <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize - fontSizeStep) }} variant="ghost"><AArrowDown /></Button>
                                <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize + fontSizeStep) }} variant="ghost"><AArrowUp /></Button>
                                <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "solid" : "ghost"}><Strikethrough /></Button>
                                <Button color="primary" isIconOnly onClick={() => { setRepeatChorus(!repeatChorus) }} variant={repeatChorus ? "solid" : "ghost"}><Repeat /></Button>
                                <Button color="primary" isIconOnly onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} variant={repeatVerseChords ? "solid" : "ghost"}><ReceiptText /></Button>

                            </ButtonGroup>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal> */}
    </>
    );
};

export default SongView;