import type { SongDB } from '@/../types/types';
import { useEffect, useRef, useState } from 'react';
import './SongList.css';
import SongRow from './SongRow';
import Toolbar from './Toolbar/Toolbar';
import useLocalStorageState from 'use-local-storage-state';
import { useFilteredSongs } from './useFilteredSongs';

const SCROLL_OFFSET_KEY = 'scrollOffset';

function SongList({ songDB }: { songDB: SongDB }) {
    // TODO: this should get something like the unified error boundary
    if (!songDB) {
        return (
            <div className='flex flex-col gap-2 w-full h-dvh justify-center items-center'>
                <h1 className='text-3xl font-bold'>Upsík dupsík. :-(</h1>
                <p>Nějak se nepodařilo nahrát písničky.</p>
            </div>
        )
    }
    const { songs } = useFilteredSongs(songDB.songs, songDB.languages);
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
                songbooks={songDB.songbooks}
            />
            <div
                ref={listRef}
                className="sm:pt-20 pt-[72px] pb-4 overflow-auto h-full"
                onScroll={handleScroll}
            >
                {songs.length ? songs.map((song) => (
                    <SongRow key={song.id} song={song} maxRange={songDB.maxRange}
                    />
                )) : (
                    <div className='w-full h-full text-xl sm:text-2xl flex items-center justify-center text-center text-primary font-bold'>
                        <p>
                            No songs fulfill all the filters set!
                        </p>
                    </div>
                )}

            </div>
        </div>
    );
}

export default SongList;