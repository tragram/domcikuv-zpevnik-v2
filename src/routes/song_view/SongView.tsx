'use client'
import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, useDisclosure, RadioGroup, Radio, ButtonGroup, Navbar, NavbarContent, NavbarMenuToggle, Link, NavbarItem, NavbarMenu, NavbarMenuItem, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import ChordSheetJS, { ChordLyricsPair } from 'chordsheetjs';
// import SongRange from "./songs_list"
import { useMediaQuery } from "@uidotdev/usehooks";
import { AArrowDown, AArrowUp, Strikethrough, Repeat, ReceiptText, SlidersHorizontal, Undo2, CaseSensitive, Plus, Minus, ArrowUpDown, Check, Github, Ruler } from 'lucide-react';
import { HashRouter, Route, Routes, useLoaderData } from "react-router-dom";
import { SongData } from '../../types';
import { useNavigate } from "react-router-dom";
import useLocalStorageState from 'use-local-storage-state'
import { AutoTextSize } from 'auto-text-size'
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

function replaceRepeatedDirective(song, directive, repeat, shortHand = "R") {
    // ChordSheetJS doesn't know the {chorus} directive but I want to use it
    const directiveMap = {}; // To store directive sections by key
    let currentdirective = null; // To store the current directive being captured
    let currentKey = null; // The key for the directive

    // Regex to match the start and end of directive
    const startOfdirectiveRegex = new RegExp(`\{start_of_${directive}(?::\\s*(\\w+))?\}`); // Matches {start_of_directive} or {start_of_directive: key}
    const endOfdirectiveRegex = new RegExp(`\{end_of_${directive}\}`); // Matches {end_of_directive}
    const directiveCallRegex = new RegExp(`\{${directive}(?::\\s*(\\w+))?\}`); // Matches {directive} or {directive: key}
    // Split content into lines
    const lines = song.split('\n');
    let processedContent = [];

    // Process each line
    for (let line of lines) {
        // Check for {start_of_directive} or {start_of_directive: key}
        let startMatch = line.match(startOfdirectiveRegex);
        if (startMatch) {
            console.log(startMatch)
            currentKey = startMatch[1] || 'default'; // Use key or default if no key is provided
            currentdirective = [];
            continue; // Skip this line from output
        }

        // Check for {end_of_directive}
        let endMatch = line.match(endOfdirectiveRegex);
        if (endMatch) {
            if (currentdirective && currentKey) {
                currentdirective[0] = `${currentKey != "default" ? currentKey : shortHand}: ` + currentdirective[0]
                // Store the directive with the start and end directives
                directiveMap[currentKey] = [`{start_of_${directive}}`].concat(currentdirective).concat([`{end_of_${directive}}`]);
            }
            processedContent.push(...directiveMap[currentKey]);
            currentdirective = null;
            currentKey = null;
            continue; // Skip this line from output
        }

        // Check for {directive} or {directive: key}
        let directiveCallMatch = line.match(directiveCallRegex);
        if (directiveCallMatch) {
            const directiveKey = directiveCallMatch[1] || 'default'; // Recall the directive with the key or the default one
            if (repeat && directiveMap[directiveKey]) {
                processedContent.push(...directiveMap[directiveKey]); // Insert the stored directive content
            } else {
                processedContent.push(`{start_of_${directive}}\n${directiveKey != "default" ? directiveKey : "R"}:\n{end_of_${directive}}`)
            }
            continue; // Skip the {directive} line
        }

        // If we are inside a directive, add the line to the directive
        if (currentdirective !== null) {
            currentdirective.push(line);
        } else {
            // Otherwise, add the line to the processed content
            processedContent.push(line);
        }
    }
    console.log(directiveMap)
    return processedContent.join('\n');
}


function TransposeButtons({ songRenderKey, setSongRenderKey }) {
    function getKeyIndex(key) {
        return renderKeys.map(x => x.toLowerCase()).indexOf(key.toLowerCase());
    }
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
            <ButtonGroup>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(renderKeys[(getKeyIndex(songRenderKey) + 11) % 12])} variant='ghost'>-</Button>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(renderKeys[(getKeyIndex(songRenderKey) + 1) % 12])} variant='ghost'>+</Button>
            </ButtonGroup>
        </div>
    </>)
}

function TransposeSettings({ songRenderKey, setSongRenderKey }) {
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
            <div className='hidden xs:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "solid" : "ghost"}><Strikethrough /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatChorus(!repeatChorus) }} variant={repeatChorus ? "solid" : "ghost"}><Repeat /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} variant={repeatVerseChords ? "solid" : "ghost"}><ReceiptText /></Button>
                </ButtonGroup>
            </div>
            <div className='flex xs:hidden'>
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

const minFontSizePx = 8;
const maxFontSizePx = 160;
const fontSizeLimits = (fontSize) => Math.min(Math.max(minFontSizePx, fontSize), maxFontSizePx);

function FontSizeSettings({ fontSize, setFontSize, autoFontSize, setAutoFontSize }) {
    const fontSizeStep = 1.1;
    // TODO: once JS stops being buggy (https://github.com/jsdom/jsdom/issues/2160), make it so that fontSize is read from the autoresizer, so there's not a jump when moving from auto to manual
    return (
        <>
            <div className='hidden sm:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize / fontSizeStep)) }} variant="ghost"><AArrowDown /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setAutoFontSize(!autoFontSize) }} variant={autoFontSize ? "solid" : "ghost"}><Ruler /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize * fontSizeStep)) }} variant="ghost"><AArrowUp /></Button>
                </ButtonGroup>
            </div>
            <div className='flex sm:hidden'>
                <Dropdown closeOnSelect={false}>
                    <DropdownTrigger>
                        <Button
                            variant="ghost" color="primary" isIconOnly
                        >
                            <CaseSensitive />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Change font size">
                        <DropdownItem startContent={<Ruler />} key="auto" onClick={() => { setAutoFontSize(!autoFontSize) }}>
                            Auto font size
                        </DropdownItem>
                        <DropdownItem startContent={<Plus />} key="+" onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize * fontSizeStep)) }}>
                            Increase font size
                        </DropdownItem>
                        <DropdownItem startContent={<Minus />} key="-" onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize / fontSizeStep)) }}>
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
    // If a match is found, return the first character of the chord
    if (match) {
        const matched_chord = match[0].slice(1, -1);
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
        "A": "A", "H": "B", "B":"Bb", "C": "C", "D": "D", "E": "E", "F": "F", "G": "G",
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
    const [chordsHidden, setChordsHidden] = useLocalStorageState("settings/chordsHidden", { defaultValue: false });
    const [repeatChorus, setRepeatChorus] = useLocalStorageState("settings/repeatChorus", { defaultValue: true });
    const [repeatVerseChords, setRepeatVerseChords] = useLocalStorageState("settings/repeatVerseChords", { defaultValue: true });
    const [fontSize, setFontSize] = useLocalStorageState("settings/fontSize", { defaultValue: 12 });
    const [autoFontSize, setAutoFontSize] = useLocalStorageState("settings/autoFontSize", { defaultValue: true });

    const [parsedContent, setParsedContent] = useState('');
    const [songRenderKey, setSongRenderKey] = useState(songData.key);
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    let navigate = useNavigate();

    function renderSong(key) {
        let song = replaceRepeatedDirective(convertChordsInChordPro(songData.content), "chorus", repeatChorus);
        song = replaceRepeatedDirective(song, "bridge", repeatChorus, "B");
        let parsedSong = parser.parse(song).setCapo(0);
        let difference = chromaticScale[key.toLowerCase()] - chromaticScale[songData.key.toLowerCase()]; // using capo in chordpro is not just a comment but actually modifies the chords... 
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

    return (<div className={`${autoFontSize ? "h-screen w-screen overflow-hidden" : ""}`}>
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
        <div className={`flex justify-center flex-col gap-3 md:gap-6 max-w-lg ${autoFontSize ? "overflow-hidden" : ""} mx-auto px-6`} style={{ height: 'calc(100% - 4rem)' }}>
            <div className='flex items-center flex-col m-auto'>
                <h1 className='text-lg font-bold'>{songData.artist} - {songData.title}</h1>
                <h2 className='opacity-70 text-sm'>Capo: {songData.capo}</h2>
            </div>
            <div className={`${autoFontSize ? "overflow-hidden flex-1" : ""}`}>
                <AutoTextSize mode="boxoneline" minFontSizePx={autoFontSize ? minFontSizePx : fontSize} maxFontSizePx={autoFontSize ? maxFontSizePx : fontSize}>
                    <div className={`m-auto  ${chordsHidden ? 'chords-hidden' : ''} ${repeatVerseChords ? '' : 'repeat-verse-chords-hidden'}`} dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content" ></div>
                </AutoTextSize>
            </div>
        </div>
    </div>
    );
};

export default SongView;