import React, { useEffect, useState } from 'react';
// import Song from "./song";
// import { Index, Document, Worker } from "flexsearch";
import Randomize from './Randomize';
import Search from './Search';
import SongRow from './SongRow';
import { Navbar, NavbarBrand, NavbarContent, NavbarItem, Input, DropdownItem, DropdownTrigger, Dropdown, DropdownMenu, Avatar, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from "@nextui-org/react";
import Filtering from './Filters';
import Sorting from './Sorting';
import { SlidersHorizontal } from 'lucide-react';
import { HashRouter, Route, Routes, Link, useLoaderData } from "react-router-dom";
const SongList = () => {
    const songDB = useLoaderData() as SongDB;
    const songs = songDB.songs;
    const exampleSong = songDB.songs[0];

    const [searchResults, setSearchResults] = useState(songs);
    const [maxRange, setMaxRange] = useState(24);
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song
    const [query, setQuery] = useState("");
    const songToKey = (song) => {
        // console.log(song.title+song.artist)
        return song.title + song.artist
    };
    // 
    const [sortSettings, setSortSettings] = useState<SortSettings>({
        order: "ascending",
        field: "title",
    });
    const [filterSettings, setFilterSettings] = useState<FilterSettings>({
        language: "all",
        vocal_range: "all",
        capo: true
    })

    const [songListData, setSongListData] = useState(songs);

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
        }, [sortSettings, filterSettings, songs, searchResults]);

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

    const navbar_items = [
        <Sorting sortSettings={sortSettings} setSortSettings={setSortSettings} />,

        <Filtering languages={songDB.languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={maxRange} />,
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
                    <Search songs={songs} setSearchResults={setSearchResults} setQuery={setQuery} />
                </NavbarItem>
                <NavbarItem className='hidden sm:flex'>
                    {navbar_items[1]}
                </NavbarItem>
                <NavbarItem className='hidden sm:flex'>
                    {navbar_items[2]}
                </NavbarItem>
            </NavbarContent >
            <NavbarMenu>
                {navbar_items.map(ni =>
                (
                    <NavbarMenuItem>
                        {ni}
                    </NavbarMenuItem>
                )
                )}
            </NavbarMenu>
        </Navbar >
        <div className='flex flex-col gap-4 p-5'>
            <div className="overflow-x-auto container mx-auto flex justify-center">
                <div className="table w-full max-w-2xl border-separate ms-3">
                    <div className="hidden md:table-header-group">
                        <div className="table-row align-center ">
                            <div className="table-cell text-left"></div>
                            <div className="table-cell text-left">Song</div>
                            <div className="table-cell text-center hidden sm:table-cell">Date added</div>
                            <div className="table-cell text-center hidden lg:table-cell">Capo</div>
                            <div className="table-cell text-center">Vocal</div>
                            <div className="table-cell text-center">Language</div>
                        </div>
                    </div>

                    <div className="table-row-group">
                        {songListData.map((song, index) => (
                            <>
                                <SongRow key={songToKey(song)} maxRange={maxRange} setSelectedSong={setSelectedSong} song={song} />
                                <div className="table-row h-5"></div>
                            </>
                        ))}
                    </div>
                </div>
            </div >
        </div >
    </>
    );
};

export default SongList;
