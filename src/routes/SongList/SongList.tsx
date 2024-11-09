
import { ModeToggle } from '@/components/mode-toggle'
import { ArrowLeftIcon, Search, SearchIcon } from 'lucide-react'
import './SongList.css'
import AutoSizer from 'react-virtualized-auto-sizer';
import Toolbar from './Toolbar/Toolbar'
import { useLoaderData } from 'react-router-dom'
import { SongDB } from '@/types'
import { Button } from "@/components/ui/button"
import memoize from 'memoize-one';
import { areEqual, VariableSizeList as List } from 'react-window';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import SongRow from './SongRow';

const SongRowMemo = memo(({ data, index, style }) => {
    if (index === 0) {
        return (
            <div style={style}>
            </div>
        )
    }
    const { songDB, setSelectedSong, filteredAndSortedSongs } = data;
    return (
        <div style={style}>
            <SongRow maxRange={songDB.maxRange} setSelectedSong={setSelectedSong} song={filteredAndSortedSongs[index - 1]} />
        </div>
    )
}, areEqual);

const createSongRowData = memoize((filteredAndSortedSongs, songDB) => ({
    filteredAndSortedSongs, songDB
}));

function SongList() {
    const songDB = useLoaderData() as SongDB;
    const songs = songDB.songs;
    const [filteredAndSortedSongs, setFilteredAndSortedSongs] = useState(songDB.songs);

    const [showToolbar, setShowToolbar] = useState(true);
    const [initialRenderDone, setInitialRenderDone] = useState(false);

    function onScroll({
        scrollDirection,
        scrollOffset,
        scrollUpdateWasRequested
    }) {
        if (!initialRenderDone) {
            // ensure the navbar is shown on initial render
            setInitialRenderDone(true);
            return;
        }
        sessionStorage.setItem('scrollOffset', scrollOffset);
        if (scrollDirection === 'forward') {
            setShowToolbar(false);
        } else if (scrollDirection === 'backward') {
            setShowToolbar(true);
        }
    };
    const songRowData = createSongRowData(filteredAndSortedSongs, songDB);
    const listMarginTop = 80;
    const itemSize = (index: number) => index > 0 ? 70 : listMarginTop;
    return (<div className='h-dvh'>
        <Toolbar songs={songs} setFilteredAndSortedSongs={setFilteredAndSortedSongs} showToolbar={showToolbar} filteredAndSortedSongs={filteredAndSortedSongs} maxRange={songDB.maxRange} languages={songDB.languages} />
        <div className='flex w-full h-full no-scrollbar'>
            <AutoSizer>
                {({ height, width }) => (
                    <List height={height} width={width}
                        itemCount={filteredAndSortedSongs.length + 1} itemSize={itemSize}
                        onScroll={onScroll}
                        itemData={songRowData}
                        itemKey={(index: number) => index > 1 ? filteredAndSortedSongs[index - 1].id : "blank" + index} overscanCount={10}
                        initialScrollOffset={parseInt(sessionStorage.getItem('scrollOffset') || '0', 10)}
                    >
                        {SongRowMemo}
                    </List>)}
            </AutoSizer>
        </div >
    </div>
    )
}

export default SongList