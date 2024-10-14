import React, { Fragment, useEffect, useState } from 'react';
// import Song from "./song";
// import { Index, Document, Worker } from "flexsearch";
import Randomize from './Randomize';
import Search from './Search';
import SongRow from './SongRow';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Input, DropdownItem, DropdownTrigger, Dropdown, DropdownMenu, Avatar, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from "@nextui-org/react";
import Filtering from './Filters';
import Sorting from './Sorting';
import { SlidersHorizontal } from 'lucide-react';
import { HashRouter, Route, Routes, Link, useLoaderData, useNavigate } from "react-router-dom";
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types';
import useLocalStorageState from 'use-local-storage-state'
const SongList = () => {
    const songDB = useLoaderData() as SongDB;
    const songs = songDB.songs;

    const [searchResults, setSearchResults] = useState(songs);
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song
    const [query, setQuery] = useState("");
    const [sortSettings, setSortSettings] = useLocalStorageState<SortSettings>("sortSettings", {
        defaultValue: {
            order: "ascending",
            field: "title",
        }
    })
    const [filterSettings, setFilterSettings] = useLocalStorageState<FilterSettings>("filterSettings", {
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

    const [songListData, setSongListData] = useState([]);
    let navigate = useNavigate();
    useEffect(
        function updateSongList() {
            //TODO: search results could be MEMOized and then it could be at the end after filters to make it faster
            let results = filterCapo(searchResults, filterSettings.capo);
            results = filterVocalRange(results, filterSettings.vocal_range);
            results = filterLanguage(results, filterSettings.language);
            if (query === "") {
                // since fuse.js already does sorting based on proximity, only re-sort if no query is present
                results = sortFunc(results, sortSettings.field, sortSettings.order);
            }
            setSongListData(results);
        }, [sortSettings, filterSettings, searchResults]);

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


    function sortFunc(results: Array<SongData>, sortByField: SortField, sortOrders: SortOrder) {
        //TODO: clean up this mess
        function compare(a: SongData, b: SongData): number {
            if (sortByField === "range") {
                const a_semi = a.range.semitones;
                const b_semi = b.range.semitones;
                if (a_semi === b_semi) {
                    // if the ranges are the same, just sort by title to make sort stable
                    return a["title"].localeCompare(b["title"]);
                } else if (!a_semi) { return -1; } else if (!b_semi) { return 1; } else {
                    return a_semi - b_semi;
                }
            } else if (sortByField === "dateAdded") {
                const diff = (a[sortByField].year * 12 + a[sortByField].month) - (b[sortByField].year * 12 + b[sortByField].month)
                if (diff == 0) {
                    return a["title"].localeCompare(b["title"]);
                } else { return diff; }
            } else if (sortByField === "artist") {
                if (a[sortByField] == b[sortByField]) {
                    return a["title"].localeCompare(b["title"]);
                } else {
                    return a[sortByField].localeCompare(b[sortByField])
                }
            }
            else {
                return a[sortByField].localeCompare(b[sortByField]);
            }
        }

        if (sortOrders === "ascending") {
            results = results.toSorted((a, b) => compare(a, b))
        }
        else if (sortOrders === "descending") {
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

    const navbar_items = [
        <Sorting sortSettings={sortSettings} setSortSettings={setSortSettings} />,

        <Filtering languages={songDB.languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={songDB.maxRange} />,
        <Randomize filteredSongs={songs} setSelectedSong={setSelectedSong} />
    ]
    return (<>
        {/* <Link to={`/song/${exampleSong.artist}/${exampleSong.title}`}>Song</Link> */}
        {/* <Song selectedSong={selectedSong} /> */}
        <Navbar shouldHideOnScroll maxWidth='xl' isBordered>
            <NavbarContent className="sm:hidden" justify="start">
                <NavbarMenuToggle icon={<SlidersHorizontal />} />
            </NavbarContent>
            <NavbarContent as="div" justify="center" className='sm:flex w-full'>
                <NavbarItem className='hidden sm:flex'>
                    {navbar_items[0]}
                </NavbarItem>
                <NavbarItem isActive className='w-full'>
                    <Search songs={songs} setSearchResults={setSearchResults} query={query} setQuery={setQuery} />
                </NavbarItem>
                <NavbarItem className='hidden sm:flex'>
                    {navbar_items[1]}
                </NavbarItem>
                <NavbarItem className='hidden sm:flex'>
                    {navbar_items[2]}
                </NavbarItem>
            </NavbarContent >
            <NavbarMenu>
                {navbar_items.map((ni, index) => {
                    return <NavbarMenuItem key={index}>
                        {ni}
                    </NavbarMenuItem>
                }
                )}
            </NavbarMenu>
        </Navbar >
        <div className='flex flex-col'>
            <div className="container mx-auto flex flex-col p-5 justify-center gap-3.5 max-w-2xl">
                {/* <div className="hidden md:table-header-group">
                        <div className="table-row align-center ">
                            <div className="table-cell text-left"></div>
                            <div className="table-cell text-left">Song</div>
                            <div className="table-cell text-center hidden sm:table-cell">Date added</div>
                            <div className="table-cell text-center hidden lg:table-cell">Capo</div>
                            <div className="table-cell text-center">Vocal</div>
                            <div className="table-cell text-center">Language</div>
                        </div>
                    </div>  */}
                {songListData.map((song) => { return <SongRow key={song.id} maxRange={songDB.maxRange} setSelectedSong={setSelectedSong} song={song} /> })}
            </div >
        </div >
    </>
    );
};

export default SongList;
