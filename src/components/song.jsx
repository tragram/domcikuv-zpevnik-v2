'use client'
import React, { useEffect, useState } from 'react';

import ChordSheetJS from 'chordsheetjs';

const Song = (song_data) => {
    const [parsedContent, setParsedContent] = useState('');

    useEffect(() => {
        // const parser = new ChordSheetJS.ChordProParser();
        // const song = parser.parse(song_data.content);
        // // const formatter = new ChordSheetJS.HtmlDivFormatter();
        // const formatter = new ChordSheetJS.HtmlTableFormatter();
        // const renderedSong = formatter.format(song);
        // ;

        // setParsedContent(renderedSong);
    }, [song_data]);

    return (
        <div className='container flex flex-col justify-center chordsheet-container' dangerouslySetInnerHTML={{ __html: parsedContent }} />
    );
};

export default Song;