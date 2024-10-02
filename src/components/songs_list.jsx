import React, { useState, useEffect } from 'react';
import Song from "./song"
import SongCard from './song_card'
import SortButton from './sort_button';
// import { Index, Document, Worker } from "flexsearch";
import LanguageFilter from './language_filter';
import Search from './search';
import Randomize from './randomize';
import { useReactTable } from '@tanstack/react-table'
import SongRow from './song_row';
import { Button } from '@nextui-org/react';
// const index = new Index(options);
// const document = new Document(options);
// const worker = new Worker(options);
import { Chip } from '@nextui-org/react';
import SortButtonMobile from './sort_button_mobile';
const SongsList = () => {
    // Store sortby order i.e. ascending or descending
    const [songs, setSongs] = useState([]);
    const [error, setError] = useState(null);

    const [searchResults, setSearchResults] = useState(songs);
    const [languages, setLanguages] = useState([]);
    const [selectedLanguage, setSelectedLanguage] = useState("all")
    const [allowCapo, setAllowCapo] = useState(true)
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song
    const songToKey = (song) => {
        // console.log(song.title+song.artist)
        return song.title + song.artist
    }
    // 
    const [songFiltering, setSongFiltering] = useState({
        query: '',
        sortType: "ascending",
        sortByField: "title",
    })

    const [songListData, setSongListData] = useState(songs)

    useEffect(
        function updateSongList() {
            let results = filterCapo(searchResults, allowCapo);
            results = filterLanguage(results, selectedLanguage);
            if (songFiltering.query === "") {
                // since fuse.js already does sorting based on proximity, only re-sort if no query is present
                results = sortFunc(results, songFiltering.sortByField, songFiltering.sortType);
            }
            setSongListData(results);
        }, [songFiltering, songs, selectedLanguage, allowCapo, searchResults])

    useEffect(
        function showSong() {
            if (selectedSong) {
                console.log(`Selected song: ${selectedSong.artist}: ${selectedSong.title}`)
            }
        }, [selectedSong]
    )


    function sortFunc(results, sortByField, sortType) {
        // console.log(results, sortByField, sortType);

        if (sortType === "ascending") {
            results = results.toSorted((a, b) => a[sortByField].localeCompare(b[sortByField]))
        }
        else if (sortType === "descending") {
            results = results.toSorted((a, b) => b[sortByField].localeCompare(a[sortByField]))
        }
        // TODO: if sort on langauge -> take title into account on a draw
        // console.log(results);
        return results;
    }

    function filterLanguage(songs, selectedLanguage) {
        if (selectedLanguage != "all") {
            return songs.filter((song) => song.language === selectedLanguage)
        } else {
            return songs;
        }
    }

    function filterCapo(songs, allowCapo) {
        if (allowCapo) {
            return songs;
        } else {
            return songs.filter((song) => song.capo == 0)
        }
    }

    function capitalizeFirstLetter(str) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
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
                setSearchResults(data);
                setLanguages(["all", ...new Set(data.map(item => item["language"]))].sort());
                // TODO: languages with less than e.g. 5 songs should be merged into "other"
            })
            .catch((error) => {
                setError(error.message);
            });
    }, []);

    if (error) {
        return <div>Error: {error}</div>;
    }

    let language_choices = languages.map((language) => ({ text: capitalizeFirstLetter(language), value: language }))

    return (
        <div className='flex flex-col gap-4 p-5'>
            <Song selectedSong={selectedSong} />
            <div className='relative flex justify-end items-center gap-2'>
                <SortButton text="Title" field="title" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="Artist" field="artist" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="Date" field="date_added" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <Search songs={songs} songFiltering={songFiltering} setSongFiltering={setSongFiltering} setSearchResults={setSearchResults} />
                <LanguageFilter text="Language" choices={language_choices} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} />
                <Button color="primary" variant={allowCapo ? "solid" : "bordered"} onClick={() => { setAllowCapo(!allowCapo) }}>Capo</Button>
                <Randomize filteredSongs={songListData} setSelectedSong={setSelectedSong} />
                <SortButtonMobile songFiltering={songFiltering} setSongFiltering={setSongFiltering}/>
            </div>
            <div className="overflow-x-auto container mx-auto flex justify-center">
                <table className="table-lg border-spacing-x-6 border-spacing-y-2 border-separate">
                    <thead>
                        <tr>
                            <th></th>
                            <th className='text-left'>Song</th>
                            <th>Date added</th>
                            <th>Language</th>
                            <th>Capo</th>
                            <th>Vocal</th>
                        </tr>
                    </thead>
                    <tbody className='even:primary'>
                        {songListData.map((song, index) => (
                            <SongRow song={song} setSelectedSong={setSelectedSong} key={songToKey(song)} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default SongsList;
