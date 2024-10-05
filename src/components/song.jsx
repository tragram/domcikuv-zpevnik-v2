'use client'
import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, RadioGroup, Radio, ButtonGroup } from "@nextui-org/react";
import ChordSheetJS from 'chordsheetjs';
import SongRange from "./songs_list"

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

function Song({ selectedSong }) {
    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState('');
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const [scrollBehavior, setScrollBehavior] = React.useState("inside");

    // const formatter = new ChordSheetJS.HtmlTableFormatter();

    function renderSong(key) {
        if (!songRenderKey) {
            // song.key = "F";
            console.log("Song key missing! Setting it to 'F' to avoid crashing but this shuold be sanitized earlier on...")
            setSongRenderKey("F");
        }
        let song = parser.parse(selectedSong.content);
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
    console.log(selectedSong);
    return (
        <Modal
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            scrollBehavior={scrollBehavior}
            size="xl"
        ><ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1">
                            {selectedSong && selectedSong.artist}: {selectedSong && selectedSong.title}
                        </ModalHeader>
                        <ModalBody>
                            <div className="" dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content"></div>
                        </ModalBody>
                        <ModalFooter className="flex flex-col">
                            <ButtonGroup>
                                {["C", "C#", "D", "Es", "E", "F", "F#", "G", "As", "A", "B", "H"].map((chord) => (
                                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                                        name="transpose_selection" onClick={() => { renderSong(chord) }} variant={selectedSong && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                                ))
                                }
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