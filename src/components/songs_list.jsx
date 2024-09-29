import React, { useState, useEffect } from 'react';
import Song from "./song"
import SongCard from './song_card'
import SortButton from './sort_button';
// import { Index, Document, Worker } from "flexsearch";
import SongFilter from './song_filter';
import Search from './search';
import Randomize from './randomize';
// const index = new Index(options);
// const document = new Document(options);
// const worker = new Worker(options);

const SongsList = () => {
    // Store sortby order i.e. ascending or descending
    const [songs, setSongs] = useState([]);
    const [error, setError] = useState(null);

    const [searchResults, setSearchResults] = useState(songs);
    const [languages, setLanguages] = useState([]);
    const [selectedLanguage, setSelectedLanguage] = useState("all")
    const [selectedCapo, setSelectedCapo] = useState("all")
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
            let results = filterCapo(searchResults, selectedCapo);
            results = filterLanguage(results, selectedLanguage);
            if (songFiltering.query === "") {
                // since fuse.js already does sorting based on proximity, only re-sort if no query is present
                results = sortFunc(results, songFiltering.sortByField, songFiltering.sortType);
            }
            setSongListData(results);
        }, [songFiltering, songs, selectedLanguage, selectedCapo, searchResults])

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

    function filterCapo(songs, selectedCapo) {
        if (selectedCapo == "allow capo" || selectedCapo == "all") {
            return songs;
        } else if (selectedCapo == "no capo") {
            return songs.filter((song) => song.capo == 0)
        } else {
            console.log("Unknown capo filtering: " + selectedCapo)
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
    let capo_choices = ["allow capo", "no capo"].map((capo) => ({ text: capitalizeFirstLetter(capo), value: capo }))
    // TODO: song sorting appears to only work on second press...
    return (
        <div className='w-full'>
            <Song selectedSong={selectedSong} />
            <div className='flex flex-row justify-center'>
                <SortButton text="Title" field="title" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="Artist" field="artist" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="Date added" field="date_added" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <Search songs={songs} songFiltering={songFiltering} setSongFiltering={setSongFiltering} setSearchResults={setSearchResults} />
                <SongFilter text="Language" choices={language_choices} setSelection={setSelectedLanguage} />
                {/* this could actually just be a 'chip' with outline when off and filled when on */}
                <SongFilter text="Capo" choices={capo_choices} setSelection={setSelectedCapo} />
                <Randomize filteredSongs={songListData} setSelectedSong={setSelectedSong} />
            </div>
            <div className='w-full flex flex-col gap-2 justify-center'>
                {songListData.map((song, index) => (
                    <SongCard song={song} setSelectedSong={setSelectedSong} key={songToKey(song)} />
                ))};
            </div>
        </div >
    );
};

export default SongsList;
