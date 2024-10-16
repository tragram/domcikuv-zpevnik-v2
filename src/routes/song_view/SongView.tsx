'use client'
import React, { useEffect, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, RadioGroup, Radio, ButtonGroup, Navbar, NavbarContent, NavbarMenuToggle, NavbarItem, NavbarMenu, NavbarMenuItem, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import ChordSheetJS, { ChordLyricsPair } from 'chordsheetjs';
// import SongRange from "./songs_list"
import { useMediaQuery } from "@uidotdev/usehooks";
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check } from 'lucide-react';
import { HashRouter, Route, Routes, Link, useLoaderData } from "react-router-dom";
import { SongData } from '../../types';
import { useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
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
    const chorusMap = {}; // To store chorus sections by key
    let currentChorus = null; // To store the current chorus being captured
    let currentKey = null; // The key for the chorus

    // Regex to match the start and end of chorus
    const startOfChorusRegex = /\{start_of_chorus(?::\s*(\w+))?\}/; // Matches {start_of_chorus} or {start_of_chorus: key}
    const endOfChorusRegex = /\{end_of_chorus\}/; // Matches {end_of_chorus}
    const chorusCallRegex = /\{chorus(?::\s*(\w+))?\}/; // Matches {chorus} or {chorus: key}

    // Split content into lines
    const lines = song.split('\n');
    let processedContent = [];

    // Process each line
    for (let line of lines) {
        // Check for {start_of_chorus} or {start_of_chorus: key}
        let startMatch = line.match(startOfChorusRegex);
        if (startMatch) {
            currentKey = startMatch[1] || 'default'; // Use key or default if no key is provided
            currentChorus = [];
            continue; // Skip this line from output
        }

        // Check for {end_of_chorus}
        if (line.match(endOfChorusRegex)) {
            if (currentChorus && currentKey) {
                currentChorus[0] = `${currentKey != "default" ? currentKey : "R"}: ` + currentChorus[0]
                // Store the chorus with the start and end directives
                chorusMap[currentKey] = `{start_of_chorus}\n${currentChorus.join('\n')}\n{end_of_chorus}`;
            }
            processedContent.push(chorusMap[currentKey]);
            currentChorus = null;
            currentKey = null;
            continue; // Skip this line from output
        }

        // Check for {chorus} or {chorus: key}
        let chorusCallMatch = line.match(chorusCallRegex);
        if (chorusCallMatch) {
            const chorusKey = chorusCallMatch[1] || 'default'; // Recall the chorus with the key or the default one
            if (repeatChorus && chorusMap[chorusKey]) {
                processedContent.push(chorusMap[chorusKey]); // Insert the stored chorus content
            } else {
                processedContent.push(`{start_of_chorus}\n${chorusKey != "default" ? chorusKey : "R"}:\n{end_of_chorus}`)
            }
            continue; // Skip the {chorus} line
        }

        // If we are inside a chorus, add the line to the chorus
        if (currentChorus !== null) {
            currentChorus.push(line);
        } else {
            // Otherwise, add the line to the processed content
            processedContent.push(line);
        }
    }

    return processedContent.join('\n');
}


function TransposeButtons({ songRenderKey, setSongRenderKey }) {
    function getKeyIndex(key) {
        return renderKeys.map(x => x.toLowerCase()).indexOf(key.toLowerCase());
    }
    return (<>
        <div className='hidden sm:flex'>
            <ButtonGroup>
                {renderKeys.map((chord) => (
                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                        name="transpose_selection" onClick={() => { setSongRenderKey(chord) }} variant={songRenderKey && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                ))
                }
            </ButtonGroup>
        </div>
        <div className='sm:hidden'>
            <ButtonGroup>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(renderKeys[(getKeyIndex(songRenderKey) + 11) % 12])} variant='ghost'>-</Button>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(renderKeys[(getKeyIndex(songRenderKey) + 1) % 12])} variant='ghost'>+</Button>
            </ButtonGroup>
        </div>
    </>)
}

function TransposeSettings({ songRenderKey, setSongRenderKey }) {
    return (<>
        <div className='hidden md:flex'>
            <ButtonGroup>
                {renderKeys.map((chord) => (
                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                        name="transpose_selection" onClick={() => { setSongRenderKey(chord) }} variant={songRenderKey && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                ))
                }
            </ButtonGroup>
        </div>
        <div className='md:hidden'>
            <Dropdown closeOnSelect={false}>
                <DropdownTrigger>
                    <Button
                        variant="ghost" color="primary" isIconOnly
                    >
                        <ArrowUpDown />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Tranpose chords">
                    <DropdownItem>
                        <TransposeButtons setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        </div>
    </>

    )
}

function SpaceSavingSettings({ chordsHidden, setChordsHidden, repeatChorus, setRepeatChorus, repeatVerseChords, setRepeatVerseChords }) {
    return (
        <>
            <div className='hidden md:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "solid" : "ghost"}><Strikethrough /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatChorus(!repeatChorus) }} variant={repeatChorus ? "solid" : "ghost"}><Repeat /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} variant={repeatVerseChords ? "solid" : "ghost"}><ReceiptText /></Button>
                </ButtonGroup>
            </div>
            <div className='flex md:hidden'>
                <Dropdown closeOnSelect={false}>
                    <DropdownTrigger>
                        <Button
                            variant="ghost" color="primary" isIconOnly
                        >
                            <ReceiptText />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Change font size">
                        <DropdownItem startContent={<Strikethrough />} key="hide_chords" onClick={() => { setChordsHidden(!chordsHidden) }} endContent={chordsHidden ? <Check /> : ""}>
                            Hide chords
                        </DropdownItem>
                        <DropdownItem startContent={<Repeat />} key="hide_repeat_chorus" onClick={() => { setRepeatChorus(!repeatChorus) }} endContent={!repeatChorus ? <Check /> : ""}>
                            Hide repeated chorus
                        </DropdownItem>
                        <DropdownItem startContent={<ReceiptText />} key="hide_verse_chords" onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} endContent={!repeatVerseChords ? <Check /> : ""}>
                            Hide chords in repeated verses
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

function FontSizeSettings({ fontSize, setFontSize }) {
    const fontSizeStep = 0.2;

    return (
        <>
            <div className='hidden md:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize - fontSizeStep) }} variant="ghost"><AArrowDown /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setFontSize(fontSize + fontSizeStep) }} variant="ghost"><AArrowUp /></Button>
                </ButtonGroup>
            </div>
            <div className='flex md:hidden'>
                <Dropdown closeOnSelect={false}>
                    <DropdownTrigger>
                        <Button
                            variant="ghost" color="primary" isIconOnly
                        >
                            <CaseSensitive />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Change font size">
                        <DropdownItem startContent={<Plus />} key="+" onClick={() => { setFontSize(fontSize + fontSizeStep) }}>
                            Increase font size
                        </DropdownItem>
                        <DropdownItem startContent={<Minus />} key="-" onClick={() => { setFontSize(fontSize - fontSizeStep) }}>
                            Decrease font size
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

function guessKey(songContent: string) {
    // Regex to match a chord inside square brackets, like [C], [G], [Ami], etc.
    const chordRegex = /\[[A-Ha-h].{0,10}\]/;
    const match = songContent.match(chordRegex);
    console.log(match)
    // If a match is found, return the first character of the chord
    if (match) {
        const matched_chord = match[0].slice(1, -1);
        console.log(matched_chord)
        return matched_chord[0];
    }

    // If no chord is found, return "C"
    return "C";
}
function convertChord(chord, toEnglish = true) {
    // chordsheet.js does not support german/czech chord names
    // Function to convert a single chord (e.g., "Ami7") between English and German
    // Dictionary mapping between English and German chords
    const englishToGerman = {
        "A": "A", "B": "H", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G",
        "A#": "A#", "C#": "C#", "D#": "D#", "F#": "F#", "G#": "G#",
        "Ab": "Ab", "Bb": "B", "Cb": "Cb", "Db": "Db", "Eb": "Eb", "Gb": "Gb",
    };

    const germanToEnglish = {
        "A": "A", "H": "B", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G",
    };
    if (!chord) {
        return chord;
    }
    // Extract the base note (first letter) and keep the rest of the chord (suffix)
    let baseNote = chord[0].toUpperCase(); // First letter is the base chord
    let suffix = chord.slice(1); // The rest of the chord (e.g., "m", "7")
    if (suffix.length > 0) {
        if (suffix[0] === "b" && !toEnglish) {
            baseNote = baseNote + suffix[0];
            suffix = suffix.slice(1);
        }
        // else if (suffix[0] === "#") {
        //     baseNote.append(suffix[0]);
        //     suffix = suffix.slice(1);
        // }
    }

    // Convert the base note
    const convertedBase = toEnglish ? germanToEnglish[baseNote] : englishToGerman[baseNote];

    // Return the converted chord with the original suffix
    return convertedBase ? convertedBase + suffix : chord;
}

// Function to convert all chords in a chordpro file
function convertChordsInChordPro(content, toEnglish = true) {
    // Convert the {key: ...} directive
    content = content.replace(/\{key:\s*([A-Ha-h][^\s]*)\}/, (match, key) => {
        console.log(match)
        return `{key: ${convertChord(key, toEnglish)}}`;
    });

    // Convert all chords in square brackets (e.g., [Ami7], [B7], etc.)
    content = content.replace(/\[([A-Ha-h][^\]]{0,10})\]/g, (match, chord) => {
        return `[${convertChord(chord, toEnglish)}]`;
    });

    return content;
}

function SongView({ }) {
    let songData = useLoaderData() as SongData;
    if (!songData.key) {
        songData.key = guessKey(songData.content);
    }
    if (songData.lyricsLength() < 50) {
        return (
            <div >
                <iframe src={songData.pdfFilenames.slice(-1)} className='w-screen h-screen' />
            </div>
        );
    };
    const [chordsHidden, setChordsHidden] = useLocalStorageState("chordsHidden", { defaultValue: false });
    const [repeatChorus, setRepeatChorus] = useLocalStorageState("repeatChorus", { defaultValue: true });
    const [repeatVerseChords, setRepeatVerseChords] = useLocalStorageState("repeatVerseChords", { defaultValue: true });
    const [fontSize, setFontSize] = useLocalStorageState("fontSize", { defaultValue: 2 });




    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState(songData.key);
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    let navigate = useNavigate();

    function renderSong(key) {
        let song = replaceChorusDirective(convertChordsInChordPro(songData.content), repeatChorus);
        let parsedSong = parser.parse(song);
        let difference = chromaticScale[key.toLowerCase()] - chromaticScale[songData.key.toLowerCase()] + 1 * parseInt(parsedSong.capo); // using capo in chordpro is not just a comment but actually modifies the chords... 
        parsedSong = parsedSong.transpose(difference);
        // convert back to Czech chord names after transposition
        parsedSong = parsedSong.mapItems((item) => {
            if (item instanceof ChordLyricsPair) {
                return new ChordLyricsPair(convertChord(item.chords, false), item.lyrics, item.annotation)
            }
            return item;
        })
        const renderedSong = formatter.format(parsedSong);
        setParsedContent(renderedSong);
    }

    useEffect(() => {
        // if (!song) {
        //     return;
        // }
        renderSong(songRenderKey);
    }, [songRenderKey, repeatChorus]);

    const fullScreen = useMediaQuery(
        "only screen and (max-width : 600px)"
    );

    return (<>
        <Navbar shouldHideOnScroll maxWidth='xl' isBordered>
            <NavbarContent justify="start">
                <Button color="primary" isIconOnly variant='ghost' onClick={() => navigate("/")}>{<Undo2 />}</Button>
            </NavbarContent>
            <NavbarContent as="div" justify="end" className='w-full'>
                <NavbarItem className=''>
                    <TransposeSettings setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
                </NavbarItem>
                <NavbarItem className=''>
                    <SpaceSavingSettings chordsHidden={chordsHidden} setChordsHidden={setChordsHidden} repeatChorus={repeatChorus} setRepeatChorus={setRepeatChorus} repeatVerseChords={repeatVerseChords} setRepeatVerseChords={setRepeatVerseChords} />
                </NavbarItem>
                <NavbarItem className=''>
                    <FontSizeSettings fontSize={fontSize} setFontSize={setFontSize} />
                </NavbarItem>
            </NavbarContent >
            {/* <NavbarContent className="md:hidden" justify="end">

            </NavbarContent> */}
        </Navbar >
        <div className='flex justify-center mt-4 flex-col gap-6 max-w-lg mx-auto'>
            <div className='flex gap-14 items-center'>
                <h1 className='text-lg font-bold'>{songData.artist} - {songData.title}</h1>
                <h2 className='opacity-70 text-sm'>Capo: {songData.capo}</h2>
            </div>
            <div className={`${chordsHidden ? 'chords-hidden' : ''} ${repeatVerseChords ? '' : 'repeat-verse-chords-hidden'}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content" style={{ fontSize: `${fontSize}vh` }}></div>
        </div>
    </>
    );
};

export default SongView;