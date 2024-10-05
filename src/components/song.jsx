'use client'
import React, { useEffect, useState } from 'react';

import ChordSheetJS from 'chordsheetjs';


function Song({ selectedSong }) {
    const [parsedContent, setParsedContent] = useState('');
    const parser = new ChordSheetJS.ChordProParser();
    const formatter = new ChordSheetJS.HtmlDivFormatter();
    // const formatter = new ChordSheetJS.HtmlTableFormatter();

    function renderSong(key) {
        let song = parser.parse(selectedSong.content);
        console.log(key, song)
        song = song.transposeUp()
        const renderedSong = formatter.format(song);
        setParsedContent(renderedSong);
    }

    useEffect(() => {
        if (!selectedSong) {
            return;
        }
        // TODO: remove the "Es", thats for testing
        renderSong(selectedSong.key)
        document.getElementById('song_modal').showModal()
    }, [selectedSong]);

    return (
        <dialog className="modal" id="song_modal">
            <div className="modal-box w-11/12 max-w-5xl">
                <div className="join full-width">
                    {["C", "C#", "D", "Es", "E", "F", "F#", "G", "As", "A", "B", "H"].map((chord) => (
                        <input aria-label={chord} className="join-item btn" defaultChecked={selectedSong && selectedSong.key.toLowerCase() == chord.toLowerCase() ? "defaultChecked" : ""} key={`transpose_selection_${chord}`}
                            name="transpose_selection" onClick={() => { console.log(chord); renderSong(chord) }} type="radio" />
                    ))}
                    {/* TODO: on small screens, just offer transpose +/- */}
                    {/* TODO: if 'key' is missing, either guess it based on the first chord or show the same as on small screens*/}
                </div>
                <h3 className="font-bold text-lg text-center">{selectedSong && selectedSong.artist}: {selectedSong && selectedSong.title}</h3>
                <p className="py-4" dangerouslySetInnerHTML={{ __html: parsedContent }} id="song_content"></p>
                <div className="modal-action">
                    <form method="dialog" >
                        {/* if there is a button, it will close the modal */}
                        <button className="btn">Close</button>
                    </form>
                </div>
            </div>
            <form className="modal-backdrop" method="dialog">
                <button>close</button>
            </form>
        </dialog>
    );
};

export default Song;