import { SongData, SongDB } from '@/types/types';
import { memo, useEffect, useRef, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import './SongList.css';
import SongRow from './SongRow';
import Toolbar from './Toolbar/Toolbar';
import useLocalStorageState from 'use-local-storage-state';
import { useFilteredSongs } from './useFilteredSongs';

const SCROLL_OFFSET_KEY = 'scrollOffset';
const INITIAL_LOAD_COUNT = 30;
const LOAD_MORE_COUNT = 20;

function SongList() {
    const songDB = useLoaderData() as SongDB;
    const { songs } = useFilteredSongs(songDB.songs);
    const listRef = useRef<HTMLDivElement>(null);
    const [showToolbar, setShowToolbar] = useState(true);
    const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(SCROLL_OFFSET_KEY, { defaultValue: 0, storageSync: false });
    const [visibleSongs, setVisibleSongs] = useState(() => songs.slice(0, INITIAL_LOAD_COUNT));
    const observerRef = useRef<IntersectionObserver | null>(null);
    
    useEffect(() => {
        if (listRef.current) {
            requestAnimationFrame(() => {
                listRef.current!.scrollTop = scrollOffset;
            });
        }
    }, [scrollOffset]);

    useEffect(() => {
        if (!songs.length) return;
        
        observerRef.current = new IntersectionObserver((entries) => {
            const lastEntry = entries[0];
            if (lastEntry.isIntersecting) {
                setVisibleSongs((prev) => songs.slice(0, prev.length + LOAD_MORE_COUNT));
            }
        }, { root: listRef.current, threshold: 1.0 });
        
        const lastSongElement = document.querySelector('.song-row:last-child');
        if (lastSongElement) {
            observerRef.current.observe(lastSongElement);
        }
        
        return () => observerRef.current?.disconnect();
    }, [songs, visibleSongs]);

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
                {visibleSongs.map((song) => (
                    <SongRow key={song.id} song={song} maxRange={songDB.maxRange} />
                ))}
            </div>
        </div>
    );
}

export default SongList;
