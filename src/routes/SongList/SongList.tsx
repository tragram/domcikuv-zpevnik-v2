import { SongData, SongDB } from '@/types/types';
import { memo, useEffect, useRef, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import './SongList.css';
import SongRow from './SongRow';
import Toolbar from './Toolbar/Toolbar';
import useLocalStorageState from 'use-local-storage-state';
import { useFilteredSongs } from './useFilteredSongs';

const SCROLL_OFFSET_KEY = 'scrollOffset';

function SongList() {
    const songDB = useLoaderData() as SongDB;
    const { songs } = useFilteredSongs(songDB.songs);
    const listRef = useRef<HTMLDivElement>(null);
    const [showToolbar, setShowToolbar] = useState(true);
    const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(SCROLL_OFFSET_KEY, { defaultValue: 0, storageSync: false });

    useEffect(() => {
        if (listRef.current) {
            requestAnimationFrame(() => {
                listRef.current!.scrollTop = scrollOffset;
            });
        }
    }, [scrollOffset]);

    const handleScroll = () => {
        if (!listRef.current) return;
        const offset = listRef.current.scrollTop;
        setScrollOffset(offset);
        setShowToolbar(offset === 0 || offset < scrollOffset);
    };

    return (
        <div className="h-dvh w-full no-scrollbar block">
            <Toolbar
                songs={songs}
                showToolbar={showToolbar}
                scrollOffset={scrollOffset}
                fakeScroll={true}
                maxRange={songDB.maxRange}
                languages={songDB.languages}
            />
            <div
                ref={listRef}
                className="sm:pt-20 pt-[72px] pb-4 overflow-auto h-full"
                onScroll={handleScroll}
            >
                {songs.map((song) => (
                    <SongRow key={song.id} song={song} maxRange={songDB.maxRange}
                    />
                ))}
            </div>
        </div>
    );
}

export default SongList;
