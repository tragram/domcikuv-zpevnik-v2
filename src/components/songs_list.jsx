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
            const query = songFiltering.query
            let results = filterLanguage(songs, selectedLanguage)
            results = results.filter(song => {
                if (query === "") return songs;
                return song[songFiltering.sortByField].toLowerCase().includes(query.toLowerCase())
            });
            setSongListData(sortFunc(results, songFiltering));
            // return results;
        }, [songFiltering, songs, selectedLanguage])



    function sortFunc(results, songFiltering) {
        const sortField = songFiltering.sortByField
        console.log(results, sortField, songFiltering.sortType);

        if (songFiltering.sortType === "ascending") {
            results.sort((a, b) => a[sortField].localeCompare(b[sortField]))
        }
        else if (songFiltering.sortType === "descending") {
            results.sort((a, b) => b[sortField].localeCompare(a[sortField]))
        }
        // TODO: sort on langauge - take title into account on a draw
        // console.log(results);
        results.forEach((r) => {
            console.log(r[sortField])
        })
        return results;
    }

    function filterLanguage(songs, selectedLanguage) {
        if (selectedLanguage != "all") {
            return songs.filter((song) => song.language === selectedLanguage)
        } else {
            return songs;
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

    return (
        <div className='w-full'>
            <div className='flex flex-row justify-center'>
                <SortButton text="title" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <SortButton text="artist" songFiltering={songFiltering} setSongFiltering={setSongFiltering} onClick={() => { }} />
                <input
                    type="text"
                    placeholder="Type here"
                    className="input input-bordered input-primary w-full max-w-xs" onChange={handleChange} />
                <SongFilter choices={languages} setSelection={setSelectedLanguage} />
            </div>
            <div className='w-full flex flex-col gap-2 justify-center'>
                {songListData.map((song, index) => (
                    <SongCard song={song} key={songToKey(song)} />
                    // <div className='container flex flex-row'  onClick={() => { console.log(song.title) }}>
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
