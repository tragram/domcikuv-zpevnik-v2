
import { SongData } from '../../types';
import {
    chordParserFactory,
    chordRendererFactory,
} from 'chord-symbol/lib/chord-symbol.js'; // bundled version
import { ChordProParser, FormatterSettings, HtmlFormatter, MusicLetter, MusicNote, Song, Transposer } from "chordproject-parser";
import { replaceRepeatedDirectives, transposeChordPro } from './preparseChordpro';

import { render } from 'react-dom';

function addRepeatClasses(htmlString, classNames = ["verse", "chorus", "bridge"], useLabels = false) {
    const defaultKey = "a4c0d35c95a63a805915367dcfe6b751"
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    let seen = {}; // Track seen chord strings by section type and label
    // Initialize `seen` for each className
    classNames.forEach(className => {
        seen[className] = { defaultKey: false };
    });

    // Loop over all elements in the document that match any of the specified classNames
    doc.querySelectorAll(classNames.map(className => `.${className}`).join(',')).forEach((element) => {
        const elementClass = classNames.find(className => element.classList.contains(className));
        if (elementClass) {
            // Extract label or use defaultKey if no label is found
            const labelElement = element.querySelector('.section-title');
            console.log(labelElement)
            const label = labelElement && useLabels ? labelElement.textContent.trim() : defaultKey;

            // Get a unique chord string representation for the element
            const chordsWElements = Array.from(element.querySelectorAll('.chord'))
                .map(el => { return { "element": el, "chord": el.textContent.trim() } })
                .filter(el => el.chord)
            const onlyChords = chordsWElements.map(c => c.chord);

            // Initialize storage for chords of this label if not already set
            if (!seen[elementClass][label]) {
                seen[elementClass][label] = [];
            }

            // Check for repetition and add class if repeated
            const chordMatches = (chords1, chords2) => {
                const zip = (a, b) => Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]]);
                const matches = zip(chords1, chords2).map(c => c[0] === c[1])
                const distance = matches.reduce((a, b) => a + (b ? 0 : 1), 0)
                return { "matches": matches, "distance": distance };
            }
            // find previous elementClass with most similar chords
            const matches = seen[elementClass][label].map((chordList) => chordMatches(chordList, onlyChords))
            const minIndex = matches.reduce((minIdx, match, idx) =>
                match.distance < matches[minIdx].distance ? idx : minIdx, 0);
            // allow at most 3 deviations
            if (seen[elementClass][label].length === 0 || matches[minIndex].distance > 3) {
                seen[elementClass][label].push(onlyChords);
            } else {
                if (matches[minIndex].distance > 0) {
                    seen[elementClass][label].push(onlyChords);
                }
                element.classList.add('repeated-chords');
                // force show chords that are different
                matches[minIndex].matches.forEach((match, index) => {
                    if (index >= chordsWElements.length) {
                        return;
                    }
                    if (!match) {
                        chordsWElements[index].element.classList.add("force-shown");
                    }
                })
                if (matches[minIndex].matches.length < chordsWElements.length) {
                    // in case there is e.g. an extra chord in the chorus at the end

                    chordsWElements.slice(-(chordsWElements.length - matches[minIndex].matches.length)).forEach(cwe => cwe.element.classList.add("force-shown"));
                }
            }
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
    return addRepeatClasses(songText, ["verse-section", "chorus-section", "bridge-section"]);
}
