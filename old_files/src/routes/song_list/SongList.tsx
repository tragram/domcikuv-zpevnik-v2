import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Navbar, NavbarContent, NavbarItem } from "@nextui-org/react";
import { useLoaderData, useNavigate } from "react-router-dom";
import AutoSizer from 'react-virtualized-auto-sizer';
import { areEqual, FixedSizeList as List } from 'react-window';
import useLocalStorageState from 'use-local-storage-state';
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types';
import Filtering from './filters/Filters';
import Randomize from './Randomize';
import Search from './Search';
import SongRow from './SongRow';
import Sorting from './Sorting';

import memoize from 'memoize-one';
import { Images } from 'lucide-react';
function Gallery() {
    let navigate = useNavigate();
    return (
        <Button color="primary" isIconOnly onClick={() => navigate("gallery")} variant="ghost">
            <Images />
        </Button>
    )
}

const SongRowMemo = memo(({ data, index, style }) => {
    const { songDB, setSelectedSong, filteredAndSortedSongs } = data;
    if (index < 1) {
        return (
            <div style={style}>
            </div>
        )
    } else {
        return (
            <div style={style}>
                <SongRow maxRange={songDB.maxRange} setSelectedSong={setSelectedSong} song={filteredAndSortedSongs[index - 1]} />
            </div>
        )
    }
}, areEqual);

const createSongRowData = memoize((filteredAndSortedSongs, songDB, setSelectedSong) => ({
    filteredAndSortedSongs, songDB, setSelectedSong
}));

const SongList = () => {
    const songDB = useLoaderData() as SongDB;
    const songs = songDB.songs;

    const [searchResults, setSearchResults] = useState(songs);
    // const [songListData, setSongListData] = useState(songs);
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song
    const [query, setQuery] = useState("");
    const [sortSettings, setSortSettings] = useLocalStorageState<SortSettings>("settings/sortSettings", {
        defaultValue: {
            order: "ascending",
            field: "title",
        }
    })
    const [filterSettings, setFilterSettings] = useLocalStorageState<FilterSettings>("settings/filterSettings", {
        defaultValue: {
            language: "all",
            vocal_range: "all",
            capo: true
        }
    })

    useEffect(
        function removeQuery() {
            setQuery("");
            setSearchResults(songs);
        }, [sortSettings]
    );

    const filteredAndSortedSongs = useMemo(() => {
        let results = filterCapo(searchResults, filterSettings.capo);
        results = filterVocalRange(results, filterSettings.vocal_range);
        results = filterLanguage(results, filterSettings.language);

        if (query === "") {
            // since fuse.js already sorts based on proximity, avoid re-sort if query is present
            results = sortFunc(results, sortSettings.field, sortSettings.order);
        }

        return results;
    }, [sortSettings, filterSettings, searchResults, query]);

    let navigate = useNavigate();

    useEffect(
        function showSong() {
            const routeChange = (song: SongData) => {
                let path = `song/${song.id}`;
                navigate(path);
            }

            if (selectedSong) {
                console.log(`Selected song: ${selectedSong.artist}: ${selectedSong.title}`);
                routeChange(selectedSong);
            }
        }, [selectedSong]
    );


    function sortFunc(results: Array<SongData>, sortByField: SortField, sortOrder: SortOrder): Array<SongData> {
        const compare = (a: SongData, b: SongData): number => {
            if (sortByField === "range") {
                const aSemi = a.range?.semitones || -Infinity;
                const bSemi = b.range?.semitones || -Infinity;
                return aSemi === bSemi ? a.title.localeCompare(b.title) : aSemi - bSemi;
            }

            if (sortByField === "dateAdded") {
                const aDate = a.dateAdded?.year * 12 + a.dateAdded?.month;
                const bDate = b.dateAdded?.year * 12 + b.dateAdded?.month;
                return aDate === bDate ? a.title.localeCompare(b.title) : aDate - bDate;
            }

            return a[sortByField].localeCompare(b[sortByField]);
        };

        const sortedResults = results.slice().sort(compare);
        return sortOrder === "ascending" ? sortedResults : sortedResults.reverse();
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

    const [showNavbar, setShowNavbar] = useState(true);
    const [initialRenderDone, setInitialRenderDone] = useState(false);

    function onScroll({
        scrollDirection,
        scrollOffset,
        scrollUpdateWasRequested
    }) {
        sessionStorage.setItem('scrollOffset', scrollOffset);
        if (!initialRenderDone) {
            // ensure the navbar is shown on initial render
            setInitialRenderDone(true);
            return;
        }
        if (scrollDirection === 'forward') {
            setShowNavbar(false);
        } else if (scrollDirection === 'backward') {
            setShowNavbar(true);
        }
    };

    const songRowData = createSongRowData(filteredAndSortedSongs, songDB, setSelectedSong);
    return (
        <main className='light text-foreground bg-background h-screen w-screen'>
            <Navbar maxWidth='2xl' isBordered className={`navbar shadow-black ${showNavbar ? 'visible-navbar' : 'hidden-navbar'}`}>
                <NavbarContent as="div" justify="center" className='sm:flex gap-2  sm:gap-4 w-full'>
                    <NavbarItem className=''>
                        <Sorting sortSettings={sortSettings} setSortSettings={setSortSettings} />
                    </NavbarItem>
                    <NavbarItem isActive className='w-full'>
                        <Search songs={songs} setSearchResults={setSearchResults} query={query} setQuery={setQuery} />
                    </NavbarItem>
                    <NavbarItem className='flex flex-row gap-1 sm:gap-4 flex-nowrap'>
                        <Filtering languages={songDB.languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={songDB.maxRange} />
                        <Randomize filteredSongs={songs} setSelectedSong={setSelectedSong} />
                        <Gallery />
                    </NavbarItem>
                </NavbarContent >
            </Navbar >
            <div className='flex h-full w-full no-scrollbar'>
                <AutoSizer>
                    {({ height, width }) => (
                        <List height={height} itemCount={filteredAndSortedSongs.length + 1} itemSize={70} width={width} onScroll={onScroll} itemData={songRowData} itemKey={(index) => index > 1 ? filteredAndSortedSongs[index - 1].id : "blank" + index} overscanCount={30} initialScrollOffset={parseInt(sessionStorage.getItem('scrollOffset') || '0', 10)}>
                            {SongRowMemo}
                        </List>)}
                </AutoSizer>
            </div >
        </main>
    );
};

export default SongList;
