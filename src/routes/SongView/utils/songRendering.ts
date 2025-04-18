
import { SongData } from '../../../types/types';
import { ChordProParser, FormatterSettings, HtmlFormatter } from "chordproject-parser";
import { czechToEnglish, replaceRepeatedDirectives, transposeChordPro } from './preparseChordpro';
import memoize from 'memoize-one';
import { Key } from '@/types/musicTypes';

function addRepeatClasses(htmlString, classNames = ["verse", "chorus", "bridge"], useLabels = false) {
    const defaultKey = "a4c0d35c95a63a805915367dcfe6b751"
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const seen = {}; // Track seen chord strings by section type and label
    // Initialize `seen` for each className
    classNames.forEach(className => {
        seen[className] = { defaultKey: false };
    });

    // First pass: Mark repeated sections (unchanged)
    doc.querySelectorAll(classNames.map(className => `.${className}`).join(',')).forEach((element) => {
        const elementClass = classNames.find(className => element.classList.contains(className));
        if (elementClass) {
            const labelElement = element.querySelector('.section-title');
            const label = labelElement && useLabels ? labelElement.textContent.trim() : defaultKey;

            const chordsWElements = Array.from(element.querySelectorAll('.chord'))
                .map(el => { return { "element": el, "chord": el.textContent.trim() } })
                .filter(el => el.chord)
            const onlyChords = chordsWElements.map(c => c.chord);

            if (!seen[elementClass][label]) {
                seen[elementClass][label] = [];
            }

            const chordMatches = (chords1, chords2) => {
                const zip = (a, b) => Array.from(Array(Math.max(b.length, a.length)), (_, i) => [a[i], b[i]]);
                const matches = zip(chords1, chords2).map(c => c[0] === c[1])
                const distance = matches.reduce((a, b) => a + (b ? 0 : 1), 0)
                return { "matches": matches, "distance": distance };
            }

            const matches = seen[elementClass][label].map((chordList) => chordMatches(chordList, onlyChords))
            const minIndex = matches.reduce((minIdx, match, idx) =>
                match.distance < matches[minIdx].distance ? idx : minIdx, 0);

            if (seen[elementClass][label].length === 0 || matches[minIndex].distance > 3) {
                seen[elementClass][label].push(onlyChords);
            } else {
                if (matches[minIndex].distance > 0) {
                    seen[elementClass][label].push(onlyChords);
                }
                element.classList.add('repeated-chords');
                matches[minIndex].matches.forEach((match, index) => {
                    if (index >= chordsWElements.length) return;
                    if (!match) {
                        chordsWElements[index].element.classList.add("force-shown");
                    }
                })
                if (matches[minIndex].matches.length < chordsWElements.length) {
                    chordsWElements.slice(-(chordsWElements.length - matches[minIndex].matches.length))
                        .forEach(cwe => cwe.element.classList.add("force-shown"));
                }
            }
        }
    });

    // Second pass: Collapse truly consecutive repeated sections
    const allSections = Array.from(doc.querySelectorAll('.section'));
    let i = 0;

    while (i < allSections.length) {
        const current = allSections[i];
        const currentClass = classNames.find(className => current.classList.contains(className));

        if (!currentClass || !current.classList.contains('repeated-chords')) {
            i++;
            continue;
        }

        // Find how many consecutive identical sections we have
        let repeatCount = 1;
        while (i + repeatCount < allSections.length) {
            const next = allSections[i + repeatCount];

            // Check if the next section is immediately adjacent in the DOM
            if (next.previousElementSibling !== allSections[i + repeatCount - 1]) {
                break;
            }

            // Check if it's the same type of section and has the same content
            if (!next.classList.contains(currentClass) ||
                !next.classList.contains('repeated-chords') ||
                next.innerHTML !== current.innerHTML) {
                break;
            }

            repeatCount++;
        }

        if (repeatCount > 1) {
            // Create repetition indicator
            const repetitionLabel = doc.createElement('span');
            repetitionLabel.className = 'repetition-count';
            repetitionLabel.textContent = `(${repeatCount}×)`;

            // Insert before the first section
            const firstLine = current.querySelector(".lyrics-line");
            if (!firstLine) return;
            firstLine.insertBefore(repetitionLabel, firstLine.firstChild);

            // Remove the subsequent repeated sections
            for (let j = 1; j < repeatCount; j++) {
                allSections[i + j].remove();
            }

            // Skip the sections we've processed
            i += repeatCount;
        } else {
            i++;
        }
    }

    return doc.body.innerHTML;
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

function convertHTMLChordToGerman(songText: string) {
    const parser = new DOMParser();
    let doc = parser.parseFromString(songText, 'text/html');
    doc = highlightRepetition(doc)
    const chords = doc.querySelectorAll(`.chord`);
    // TODO: this should be separate from German conversion
    chords.forEach((chord) => {
        chord.textContent = chordToGerman(chord.textContent);
        chord.innerHTML = chord.textContent.replace(/b/g, "♭").replace(/#/g, "♯").replace(/(♯|♭|2|4|6|7|9|maj|sus|\+|\([^()]*\))/g, "<sup>$1</sup>");
    })
    return doc.body.innerHTML;
}

function highlightRepetition(doc: Document) {
    // Find all divs with the class "section"
    const sections = doc.querySelectorAll("div.section");


    sections.forEach((section) => {
        // Find all lyrics spans containing 𝄆 or 𝄇
        const repetitionSpans = section.querySelectorAll("span.lyrics");

        repetitionSpans.forEach((span) => {
            if (span.textContent?.includes("𝄆") || span.textContent?.includes("𝄇")) {
                // Create a wrapping div with class "repetition"
                const repetitionDiv = document.createElement("div");
                repetitionDiv.className = "repetition";

                // Wrap the current span
                span.replaceWith(repetitionDiv);
                repetitionDiv.appendChild(span);
            }
        });
    });
    return doc;
}

function parseChordPro(chordProContent: string, repeatChorus: boolean, songKey: Key, transposeSteps: number) {
    const memoizedCzechToEnglish = memoize(czechToEnglish);
    const withEnglishChords = memoizedCzechToEnglish(chordProContent);
    const preparsedContent = replaceRepeatedDirectives(withEnglishChords, ["chorus", "bridge", "verse"], ["R", "B", ""], repeatChorus);
    const transposedContent = transposeChordPro(preparsedContent, songKey, transposeSteps);
    const parser = new ChordProParser();
    const song = parser.parse(transposedContent);
    return song;
}

export function guessKey(chordProContent: string): Key | undefined {
    const song = parseChordPro(chordProContent, false, null, null);
    return Key.parse(song.getPossibleKey()?.toString() || "", false);
}

export function renderSong(songData: SongData, transposeSteps: number, repeatChorus: boolean, czechChordNames: boolean): string {
    // repeat choruses/bridges/verses if necessary
    const song = parseChordPro(songData.content, repeatChorus, songData.key, transposeSteps);
    const settings = new FormatterSettings();
    settings.showMetadata = false;
    const formatter = new HtmlFormatter(settings);
    let songText = formatter.format(song).join('\n');
    if (czechChordNames) { songText = convertHTMLChordToGerman(songText); }
    return addRepeatClasses(songText, ["verse-section", "chorus-section", "bridge-section"]);
}
