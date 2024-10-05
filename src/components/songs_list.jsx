import React, { useEffect, useState } from 'react';
import Song from "./song";
// import { Index, Document, Worker } from "flexsearch";
import Randomize from './randomize';
import Search from './search';
import SongRow from './song_row';
// const index = new Index(options);
// const document = new Document(options);
// const worker = new Worker(options);
import Filtering from './filters';
import Sorting from './sorting';
class SongRange {
    constructor(song_range_str) {
        const chromaticScale = {
            "c": 0,
            "c#": 1,
            "db": 1,
            "d": 2,
            "d#": 3,
            "eb": 3,
            "e": 4,
            "f": 5,
            "f#": 6,
            "gb": 6,
            "g": 7,
            "g#": 8,
            "ab": 8,
            "a": 9,
            "a#": 10,
            "bb": 10,
            "b": 11,
            "h": 11
        };
        if (!song_range_str || !song_range_str.includes("-")) {
            // return <></>
            // song_range_str = "c1-d3"
            this.min = "?"
            this.max = "?"
            this.semitones = "?";
        } else {
            const songRange = song_range_str.split("-");
            const octaves = songRange[1].slice([-1]) - songRange[0].slice([-1])
            const lowestTone = songRange[0].slice(0, -1).toLowerCase()
            const highestTone = songRange[1].slice(0, -1).toLowerCase()
            const withinOctave = chromaticScale[highestTone] - chromaticScale[lowestTone]

            // console.log(octaves, withinOctave, 12 * octaves + withinOctave)
            this.min = songRange[0]
            this.max = songRange[1]
            this.semitones = 12 * octaves + withinOctave;
        }
    }
}

const SongsList = () => {
    // Store sortby order i.e. ascending or descending
    const [songs, setSongs] = useState([]);
    const [error, setError] = useState(null);

    const [searchResults, setSearchResults] = useState(songs);
    const [languages, setLanguages] = useState([]);
    const [maxRange, setMaxRange] = useState(24);
    const [selectedLanguage, setSelectedLanguage] = useState("all");
    const [allowCapo, setAllowCapo] = useState(true);
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song
    const [vocalRange, setVocalRange] = useState("all")
    const songToKey = (song) => {
        // console.log(song.title+song.artist)
        return song.title + song.artist
    };
    // 
    const [songFiltering, setSongFiltering] = useState({
        query: '',
        sortType: "ascending",
        sortByField: "title",
    });

    const [songListData, setSongListData] = useState(songs);

    useEffect(
        function updateSongList() {
            let results = filterCapo(searchResults, allowCapo);
            results = filterVocalRange(results, vocalRange);
            results = filterLanguage(results, selectedLanguage);
            if (songFiltering.query === "") {
                // since fuse.js already does sorting based on proximity, only re-sort if no query is present
                results = sortFunc(results, songFiltering.sortByField, songFiltering.sortType);
            }
            setSongListData(results);
        }, [songFiltering, songs, selectedLanguage, allowCapo, searchResults, vocalRange]);

    useEffect(
        function showSong() {
            if (selectedSong) {
                console.log(`Selected song: ${selectedSong.artist}: ${selectedSong.title}`)
            }
        }, [selectedSong]
    );


    function sortFunc(results, sortByField, sortType) {
        function compare(a, b) {
            if (sortByField === "range") {
                const a_semi = a.range.semitones;
                const b_semi = b.range.semitones;
                if (a_semi === b_semi) {
                    // if the ranges are the same, just sort by title
                    return a["title"].localeCompare(b["title"]);
                } else {
                    return a_semi < b_semi;
                }
            } else {
                return a[sortByField].localeCompare(b[sortByField]);
            }
        }

        if (sortType === "ascending") {
            results = results.toSorted((a, b) => compare(a, b))
        }
        else if (sortType === "descending") {
            results = results.toSorted((a, b) => compare(b, a))
        } else { console.log("Unknown ordering!") }
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

    function filterVocalRange(songs, vocalRange) {
        function inRange(x, min, max) {
            return ((x - min) * (x - max) <= 0);
        }
        if (vocalRange === "all") {
            return songs;
        } else {
            return songs.filter(song => inRange(song.range.semitones, vocalRange[0], vocalRange[1]));
        }
    }


    useEffect(() => {
        // Fetch the songs.json file from the public folder

        fetch(import.meta.env.BASE_URL + '/songs.json')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to fetch songs');
                }
                return response.json();
            })
            .then((data) => {
                data.forEach(song => {
                    song.range = new SongRange(song.range);
                });
                setSongs(data);
                setSearchResults(data);
                setLanguages(["all", ...new Set(data.map(item => item["language"]))].sort());
                let songRanges = data.map(song => (song.range.semitones)).filter(range => range != "?");
                setMaxRange(Math.max(songRanges));
                // TODO: languages with less than e.g. 5 songs should be merged into "other"
            })
            .catch((error) => {
                setError(error.message);
            });
    }, []);

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div className='flex flex-col gap-4 p-5'>
            <Song selectedSong={selectedSong} />
            <div className='relative flex justify-end items-center gap-2'>
                <Sorting songFiltering={songFiltering} setSongFiltering={setSongFiltering} />
                <Search songs={songs} songFiltering={songFiltering} setSongFiltering={setSongFiltering} setSearchResults={setSearchResults} />
                <Filtering languages={languages} selectedLanguage={selectedLanguage} setSelectedLanguage={setSelectedLanguage} allowCapo={allowCapo} setAllowCapo={setAllowCapo} maxRange={maxRange} vocalRange={vocalRange} setVocalRange={setVocalRange} />
                <Randomize filteredSongs={songListData} setSelectedSong={setSelectedSong} />
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
                            <SongRow song={song} setSelectedSong={setSelectedSong} key={songToKey(song)} maxRange={maxRange} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div >
    );
};

export default SongsList;
