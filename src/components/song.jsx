'use client'
import React, { useEffect, useState } from 'react';

import ChordSheetJS from 'chordsheetjs';


function Song({ selectedSong }) {
    const [parsedContent, setParsedContent] = useState('');
    const parser = new ChordSheetJS.ChordProParser();
    // const formatter = new ChordSheetJS.HtmlDivFormatter();
    const formatter = new ChordSheetJS.HtmlTableFormatter();
    useEffect(() => {
        if (!selectedSong) {
            return;
        }
        const song = parser.parse(selectedSong.content);
        const renderedSong = formatter.format(song);
        setParsedContent(renderedSong);
        document.getElementById('my_modal_4').showModal()
    }, [selectedSong]);

    return (
        <dialog id="my_modal_4" className="modal">
            <div className="modal-box w-11/12 max-w-5xl">
                <h3 className="font-bold text-lg">{selectedSong && selectedSong.title}</h3>
                <p className="py-4" id="song_content" dangerouslySetInnerHTML={{ __html: parsedContent }}></p>
                <div className="modal-action">
                    <form method="dialog" >
                        {/* if there is a button, it will close the modal */}
                        <button className="btn">Close</button>
                    </form>
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
};

export default Song;