import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Navbar, NavbarContent, NavbarItem } from "@nextui-org/react";
import { useLoaderData, useNavigate } from "react-router-dom";
import AutoSizer from 'react-virtualized-auto-sizer';
import { areEqual, FixedSizeList as List } from 'react-window';
import useLocalStorageState from 'use-local-storage-state';
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types';
import Filtering from './filters/Filters';
import Randomize from './Randomize';
import Search from '../SongList/Toolbar/SearchBar';
import SongRow from './SongRow';
import Sorting from './Sorting';

import { Images } from 'lucide-react';
function Gallery() {
    const navigate = useNavigate();
    return (
        <Button color="primary" isIconOnly onClick={() => navigate("gallery")} variant="ghost">
            <Images />
        </Button>
    )
}


const SongList = () => {

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
            
        </main>
    );
};

export default SongList;
