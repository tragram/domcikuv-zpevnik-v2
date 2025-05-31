import { useEffect, useRef, useState } from 'react';
import './SongList.css';
import SongRow from './SongRow';
import Toolbar from './Toolbar/Toolbar';
import useLocalStorageState from 'use-local-storage-state';
import { useFilteredSongs } from './useFilteredSongs';
import useSongDB from '@/components/hooks/useSongDB';
import { SongDB } from 'src/types/types';

const SCROLL_OFFSET_KEY = 'scrollOffset';

function SongList() {
    const { songDB, isLoading, isError } = useSongDB();

    if (isLoading)
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-2"></div>
                    <p>Loading songs...</p>
                </div>
            </div>
        );
    else if (isError)
        return (
            <div className='flex flex-col gap-2 w-full h-dvh justify-center items-center'>
                <h1 className='text-3xl font-bold'>Upsík dupsík. :-(</h1>
                <p>Nějak se nepodařilo nahrát písničky.</p>
            </div>
        )
    else
        return <SongListComponent songDB={songDB} />
}

function SongListComponent({ songDB }: { songDB: SongDB }) {
    const { songs } = useFilteredSongs(songDB.songs, songDB.languages);
    const listRef = useRef<HTMLDivElement>(null);
    const [showToolbar, setShowToolbar] = useState(true);
    const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(SCROLL_OFFSET_KEY, { defaultValue: 0, storageSync: false });

    // useEffect(() => {
    //     if (listRef.current) {
    //         requestAnimationFrame(() => {
    //             listRef.current!.scrollTop = scrollOffset;
    //         });
    //     }
    // }, [scrollOffset]);

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