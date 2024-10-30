
import { SongData } from '../../types';
import {
    chordParserFactory,
    chordRendererFactory,
} from 'chord-symbol/lib/chord-symbol.js'; // bundled version
import { ChordProParser, FormatterSettings, HtmlFormatter, MusicLetter, MusicNote, Song, Transposer } from "chordproject-parser";
import { replaceRepeatedDirectives, transposeChordPro } from './preparseChordpro';

import { render } from 'react-dom';

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
    } else if (trimmedChord.endsWith("Bb")) {
        return trimmedChord.slice(0, -2) + "B";
    } else if (trimmedChord.endsWith("B")) {
        return trimmedChord.slice(0, -1) + "H";
    }
    return chord;
}

function noteToEnglish(note: string) {
    if (note === "B") {
        return "Bb";
    } else if (note === "H") {
        return "B";
    }
    return note;
}

function convertHTMLChordToGerman(songText: string) {
    // TODO: force display chords could be done here
    const parser = new DOMParser();
    const doc = parser.parseFromString(songText, 'text/html');
    const chords = doc.querySelectorAll(`.chord`);
    chords.forEach((chord) => {
        chord.textContent = chordToGerman(chord.textContent);
    })
    return doc.body.innerHTML;
}

function parseChordPro(chordProContent: string, repeatChorus: boolean, songKey, newKey) {
    let preparsedContent = replaceRepeatedDirectives(chordProContent, ["chorus", "bridge", "verse"], ["R", "B", ""], repeatChorus);
    const transposedContent = transposeChordPro(preparsedContent, songKey, newKey);
    const parser = new ChordProParser();
    const song = parser.parse(transposedContent);
    return song;
}

export function guessKey(chordProContent: string) {
    const song = parseChordPro(chordProContent, false, null, null);
    return MusicLetter[song.getPossibleKey().note.letter];
}

export function renderSong(songData: SongData, newKey: string, repeatChorus: boolean): string {
    // repeat choruses/bridges/verses if necessary
    const song = parseChordPro(songData.content, repeatChorus, songData.key, newKey);
    const settings = new FormatterSettings();
    settings.showMetadata = false;
    const formatter = new HtmlFormatter(settings);
    let songText = formatter.format(song).join('\n');
    songText = convertHTMLChordToGerman(songText);
    return addRepeatClasses(addRepeatClasses(addRepeatClasses(songText, "verse-section"), "chorus-section"), "bridge-section");
}
