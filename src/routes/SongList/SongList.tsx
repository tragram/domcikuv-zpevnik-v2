
import { ModeToggle } from '@/components/mode-toggle'
import { ArrowLeftIcon, Search, SearchIcon } from 'lucide-react'

import AutoSizer from 'react-virtualized-auto-sizer';
import Toolbar from './Toolbar/Toolbar'
import { useLoaderData } from 'react-router-dom'
import { SongDB } from '@/types'
import { Button } from "@/components/ui/button"
import memoize from 'memoize-one';
import { areEqual, FixedSizeList as List } from 'react-window';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

const SongRowMemo = memo(({ data, index, style }) => {
    const { songDB, setSelectedSong, filteredAndSortedSongs } = data;
    if (index < 1) {
        return (
            <div style={style}>
            </div>
        )
    } else {
        return (
            <div style={style} className='h-[70px] w-24 p-4'>
                <div className='bg-yellow-900 h-full w-full'></div>
                {/* <SongRow maxRange={songDB.maxRange} setSelectedSong={setSelectedSong} song={filteredAndSortedSongs[index - 1]} /> */}
            </div>
        )
    }
}, areEqual);

const createSongRowData = memoize((filteredAndSortedSongs, songDB, setSelectedSong) => ({
    filteredAndSortedSongs, songDB, setSelectedSong
}));

function SongList() {
    const songDB = useLoaderData() as SongDB;
    const songs = songDB.songs;
    const [filteredAndSortedSongs, setFilteredAndSortedSongs] = useState(songDB.songs);
    const [selectedSong, setSelectedSong] = useState(null); // State for selected song

    const [showToolbar, setShowToolbar] = useState(true);
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
            setShowToolbar(false);
        } else if (scrollDirection === 'backward') {
            setShowToolbar(true);
        }
    };

    const songRowData = createSongRowData(filteredAndSortedSongs, songDB, setSelectedSong);
    console.log(filteredAndSortedSongs)
    return (<>
        <Toolbar songs={songs} setFilteredAndSortedSongs={setFilteredAndSortedSongs} showToolbar={showToolbar} />
        <div className='flex w-full no-scrollbar h-screen'>
            <AutoSizer>
                {({ height, width }) => (
                    <List height={height} itemCount={filteredAndSortedSongs.length + 1} itemSize={70} width={width} onScroll={onScroll} itemData={songRowData} itemKey={(index) => index > 1 ? filteredAndSortedSongs[index - 1].id : "blank" + index} overscanCount={30} initialScrollOffset={parseInt(sessionStorage.getItem('scrollOffset') || '0', 10)}>
                        {SongRowMemo}
                    </List>)}
            </AutoSizer>
        </div >
    </>
    )
}

export default SongList