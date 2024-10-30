
import ChordSheetJS, { ChordLyricsPair, ChordSheetSerializer, Tag } from 'chordsheetjs';
import { SongData } from '../../types';
import { Song as ChordSheetJSSong } from 'chordsheetjs';

import { ChordProParser, FormatterSettings, HtmlFormatter, MusicLetter, MusicNote, Transposer } from "chordproject-parser";
import { convertChordsInChordPro, replaceRepeatedDirectives } from './preparseChordpro';
import {
    chordParserFactory,
    chordRendererFactory,
} from 'chord-symbol/lib/chord-symbol.js'; // bundled version

function addRepeatClasses(htmlString, className = "verse") {
    // adds the 'repeated-chords' where appropriate class
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const verses = doc.querySelectorAll(`.${className}`);
    let seen = { "default": false };
    verses.forEach((verse) => {
        const labelElement = verse.querySelector('.label');
        const label = labelElement ? labelElement.textContent.trim() : "default";
        const chords_str = Array.from(verse.querySelectorAll('.chord')).map(el => el.textContent.trim()).filter(el => el).join('_')
        if (!seen[label]) {
            seen[label] = [];
        }
        if (seen[label].includes(chords_str)) {
            verse.classList.add('repeated-chords');
        } else {
            seen[label].push(chords_str);
        }
    });
    return doc.body.innerHTML; // Convert the document back to an HTML string
}

function chordToGerman(chord: string) {
    const trimmedChord = chord.trim()
    if (trimmedChord.startsWith("Bb")) {
        return "B" + trimmedChord.slice(2);
    } else if (trimmedChord.startsWith("B")) {
        return "H" + trimmedChord.slice(1);
    }
    return chord;
}

function convertHTMLChordToGerman(songText: string) {
    // TODO: force display chords could be done here
    const parser = new DOMParser();
    const doc = parser.parseFromString(songText, 'text/html');
    const chords = doc.querySelectorAll(`.chord`);
    chords.forEach((chord) => {
        chord.textContent = chordToGerman(chord.textContent);
    })
    // console.log(songText)
    return doc.body.innerHTML;
}

function parseChordPro(chordProContent: string, songKey: string | null, key: string | null, repeatChorus: boolean) {
    let preparsedContent = replaceRepeatedDirectives(chordProContent, ["chorus", "bridge", "verse"], ["R", "B", ""], repeatChorus);
    // Convert chords to English
    preparsedContent = convertChordsInChordPro(preparsedContent, songKey?.toUpperCase(), key);
    const parser = new ChordProParser();
    const song = parser.parse(preparsedContent);
    return song;
}

export function guessKey(chordProContent: string) {
    const song = parseChordPro(chordProContent, null, null, false);
    return chordToGerman(MusicLetter[song.getPossibleKey().note.letter]);
}

export function renderSong(songData: SongData, key: string, repeatChorus: boolean): string {
    // repeat choruses/bridges/verses if necessary
    const song = parseChordPro(songData.content, songData.key, key, repeatChorus);
    const settings = new FormatterSettings();
    settings.showMetadata = false;
    const formatter = new HtmlFormatter(settings);
    let songText = formatter.format(song).join('\n');
    songText = convertHTMLChordToGerman(songText);
    return addRepeatClasses(addRepeatClasses(addRepeatClasses(songText, "verse-section"), "chorus-section"), "bridge-section");
}
