import React, { useState, useEffect } from 'react';
// import Song from "./song"
import SongCard from './song_card'
import SortButton from './sort_button';
// import { Index, Document, Worker } from "flexsearch";
import SongFilter from './song_filter';
// const index = new Index(options);
// const document = new Document(options);
// const worker = new Worker(options);

const SongsList = () => {

    // Store sortby order i.e. ascending or descending
    const [songs, setSongs] = useState([]);
    const [error, setError] = useState(null);

    const [result, setResult] = useState();
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

    // Filter posts on typing in search input
    const handleChange = (e) => {
        setSongFiltering({
            query: e.target.value,
            sortType: songFiltering.sortType,
            sortByField: songFiltering.sortByField
        });
    }
    useEffect(
        function updateSongList() {
            let results = filterCapo(songs, selectedCapo);
            console.log(results)
            results = filterLanguage(results, selectedLanguage);
            results = filterSearch(results, songFiltering.query);
            setSongListData(sortFunc(results, songFiltering));
            // return results;
        }, [songFiltering, songs, selectedLanguage, selectedCapo])



    function sortFunc(results, songFiltering) {
        const sortField = songFiltering.sortByField
        console.log(results, sortField, songFiltering.sortType);

        if (songFiltering.sortType === "ascending") {
            results.sort((a, b) => a[sortField].localeCompare(b[sortField]))
        }
        else if (songFiltering.sortType === "descending") {
            results.sort((a, b) => b[sortField].localeCompare(a[sortField]))
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

    function filterSearch(songs, searchQuery) {
        if (searchQuery === "") return songs;
        // TODO: search in all fields
        else {
            return songs.filter(song => {
                song[songFiltering.sortByField].toLowerCase().includes(searchQuery.toLowerCase())
            });
        }
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
                setLanguages(["all", ...new Set(data.map(item => item["language"]))].sort());
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
            <div className='flex flex-row justify-center'>
                <SortButton text="Title" field="title" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="Artist" field="artist" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="Date added" field="date_added" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <input
                    type="text"
                    placeholder="Type here"
                    className="input input-bordered input-primary w-full max-w-xs" onChange={handleChange} />
                <SongFilter text="Language" choices={language_choices} setSelection={setSelectedLanguage} />
                <SongFilter text="Capo" choices={capo_choices} setSelection={setSelectedCapo} />
            </div>
            <div className='w-full flex flex-col gap-2 justify-center'>
                {songListData.map((song, index) => (
                    <SongCard song={song} key={songToKey(song)} />
                ))};
            </div>
        </div >
    );
};

export default SongsList;
