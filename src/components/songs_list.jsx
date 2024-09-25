'use client'
import React, { useState, useEffect } from 'react';
// import Song from "./song"
import SongCard from './song_card'
import SongButton from './sort_button';
const SongsList = () => {
    const [activeSort, setActiveSort] = useState("title")
    const [songs, setSongs] = useState([]);
    const [error, setError] = useState(null);
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song
    const songToKey = (song) => {
        // console.log(song.title+song.artist)
        return song.title + song.artist
    }

    useEffect(() => {
        // Fetch the songs.json file from the public folder
        fetch('songs.json')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to fetch songs');
                }
                return response.json();
            })
            .then((data) => {
                setSongs(data);
            })
            .catch((error) => {
                setError(error.message);
            });
    }, []);

    if (error) {
        return <div>Error: {error}</div>;
    }


    return (
        <div className='w-full'>
            <h1>Songs List</h1>
            <div className='flex flex-row'>
                <SongButton text="title" activeSort={activeSort} setActiveSort={setActiveSort} onClick={() => { }} />
                <SongButton text="artist" activeSort={activeSort} setActiveSort={setActiveSort} onClick={() => { }} />
            </div>
            <div className='container flex flex-col gap-2'>
                {songs.map((song, index) => (
                    <SongCard song={song} />
                    // <div className='container flex flex-row' key={songToKey(song)} onClick={() => { console.log(song.title) }}>
                    //     <div className="flex flex-col justify-start">
                    //         <p className="text-md">{song.title}</p>
                    //         <p className="text-small text-default-500">{song.artist}</p>
                    //     </div>
                    // </div>
                ))};
            </div>
        </div >
    );
};

export default SongsList;
