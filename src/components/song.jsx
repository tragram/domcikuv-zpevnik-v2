'use client'
import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, RadioGroup, Radio, ButtonGroup } from "@nextui-org/react";
import ChordSheetJS from 'chordsheetjs';
import SongRange from "./songs_list"
import { useMediaQuery } from "@uidotdev/usehooks";
import { AArrowDown, AArrowUp, Strikethrough } from 'lucide-react';

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

function removeChorusDirective(song) {
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
            processedLines.push(currentChorus.trim());
        } else {
            processedLines.push(line);
        }
    });

    return processedLines.join("\n");
}

function Song({ selectedSong }) {
    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState('');
    const [chordsHidden, setChordsHidden] = useState(false);
    const [fontSize, setFontSize] = useState(2);
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [scrollBehavior, setScrollBehavior] = React.useState("inside");


    // const formatter = new ChordSheetJS.HtmlTableFormatter();

    function renderSong(key) {
        if (!songRenderKey) {
            // song.key = "F";
            console.log("Song key missing! Setting it to 'F' to avoid crashing but this should be sanitized earlier on...")
            setSongRenderKey("F");
        }
        let song = removeChorusDirective(selectedSong.content);
        console.log(song)
        song = parser.parse(song);
        // console.log(key, sle)
        // song = song.transposeUp()
        let difference = chromaticScale[key.toLowerCase()] - chromaticScale[selectedSong.key.toLowerCase()] + 1 * song.capo; // using capo in chordpro is not just a comment but actually modifies the chords... 
        setSongRenderKey(key);
        console.log(key.toLowerCase(), songRenderKey.toLowerCase(), difference, selectedSong.key)
        song = song.transpose(difference)
        const renderedSong = formatter.format(song);
        setParsedContent(renderedSong);
    }

    useEffect(() => {
        if (!selectedSong) {
            return;
        }
        setSongRenderKey(selectedSong.key);
        renderSong(selectedSong.key);
        onOpen();
    }, [selectedSong]);
    const fullScreen = useMediaQuery(
        "only screen and (max-width : 600px)"
    );
    const fontSizeStep = 0.2;
    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            scrollBehavior={scrollBehavior}
            size={fullScreen ? "full" : "xl"}
        ><ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            {selectedSong && selectedSong.artist}: {selectedSong && selectedSong.title}
                        </ModalHeader>
                        <ModalBody>
                            <div className={`${chordsHidden?'chords-hidden':''}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content" style={{ fontSize: `${fontSize}vh` }}></div>
                        </ModalBody>
                        <ModalFooter className="flex flex-col">
                            <ButtonGroup>
                                {["C", "C#", "D", "Es", "E", "F", "F#", "G", "As", "A", "B", "H"].map((chord) => (
                                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                                        name="transpose_selection" onClick={() => { renderSong(chord) }} variant={selectedSong && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                                ))
                                }
                            </ButtonGroup>
                            <ButtonGroup>
                                <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize - fontSizeStep) }} variant="ghost"><AArrowDown /></Button>
                                <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize + fontSizeStep) }} variant="ghost"><AArrowUp /></Button>
                                <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "solid" : "ghost"}><Strikethrough /></Button>
                            </ButtonGroup>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
        // <dialog className="modal" id="song_modal">
        //     <div className="modal-box w-11/12 max-w-5xl">
        //             {/* TODO: on small screens, just offer transpose +/- */}
        //             {/* TODO: if 'key' is missing, either guess it based on the first chord or show the same as on small screens*/}
        //         </div>
        //         <h3 className="font-bold text-lg text-center"></h3>
        //         <p className="py-4" dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content"></p>
        //         <div className="modal-action">
        //             <form method="dialog" >
        //                 {/* if there is a button, it will close the modal */}
        //                 <button className="btn">Close</button>
        //             </form>
        //         </div>
        //     </div>
        // </dialog>
    );
};

export default Song;