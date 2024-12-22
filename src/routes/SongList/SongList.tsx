
import { SongData, SongDB } from '@/types';
import memoize from 'memoize-one';
import { memo, useCallback, useRef, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import AutoSizer from 'react-virtualized-auto-sizer';
import { areEqual, VariableSizeList as List } from 'react-window';
import theme from 'tailwindcss/defaultTheme';
import './SongList.css';
import SongRow from './SongRow';
import Toolbar from './Toolbar/Toolbar';
import useLocalStorageState from 'use-local-storage-state';

const SCROLL_OFFSET_KEY = 'scrollOffset';
const TOOLBAR_HEIGHT = {
    sm: 88,
    default: 72
};

interface Breakpoint {
    [key: string]: string;
}

const getCurrentBreakpoints = (): string[] => {
    return Object.entries(theme.screens as Breakpoint)
        .filter(([_, value]) => window.innerWidth > parseInt(value, 10))
        .map(([key]) => key);
};

interface SongRowData {
    songDB: SongDB;
    filteredAndSortedSongs: SongData[];
}
interface SongRowProps {
    data: SongRowData;
    index: number;
    style: React.CSSProperties;
}

const SongRowMemo = memo(({ data, index, style }: SongRowProps) => {
    if (index === 0) {
        return (
            <div style={style}></div>
        )
    }
    const { songDB, filteredAndSortedSongs } = data;
    return (
        <div style={style}>
            <SongRow
                maxRange={songDB.maxRange}
                song={filteredAndSortedSongs[index - 1]}
            />
        </div>
    )
}, areEqual);

const createSongRowData = memoize((
    filteredAndSortedSongs: SongData[],
    songDB: SongDB
): SongRowData => ({
    filteredAndSortedSongs,
    songDB
}));

function SongList() {
    const songDB = useLoaderData() as SongDB;
    const listRef = useRef<List>(null);

    const [filteredAndSortedSongs, setFilteredAndSortedSongs] = useState(songDB.songs);
    const [showToolbar, setShowToolbar] = useState(true);
    const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(SCROLL_OFFSET_KEY, { defaultValue: 0, storageSync: false })
    const [initialRenderDone, setInitialRenderDone] = useState(false);

    const handleScroll = useCallback(({
        scrollDirection,
        scrollOffset,
        scrollUpdateWasRequested
    }) => {
        if (!initialRenderDone) {
            setInitialRenderDone(true);
            return;
        }
        setScrollOffset(scrollOffset);
        setShowToolbar(scrollDirection === 'backward');
    }, [initialRenderDone]);

    const getItemSize = useCallback((index: number) => {
        if (index === 0) {
            const currentBreakpoints = getCurrentBreakpoints();
            return currentBreakpoints.includes("sm")
                ? TOOLBAR_HEIGHT.sm
                : TOOLBAR_HEIGHT.default;
        }
        return 70;
    }, []);

    const getItemKey = useCallback((index: number) => {
        return index === 0
            ? "toolbar-spacer"
            : filteredAndSortedSongs[index - 1].id;
    }, [filteredAndSortedSongs]);

    const songRowData = createSongRowData(filteredAndSortedSongs, songDB);
    const initialScrollOffset = parseInt(
        sessionStorage.getItem(SCROLL_OFFSET_KEY) || '0',
        10
    );

    return (
        <div className="h-dvh">
            <Toolbar
                songs={songDB.songs}
                setFilteredAndSortedSongs={setFilteredAndSortedSongs}
                showToolbar={showToolbar}
                scrollOffset={scrollOffset}
                fakeScroll={true}
                filteredAndSortedSongs={filteredAndSortedSongs}
                maxRange={songDB.maxRange}
                languages={songDB.languages}
            />
            <div className="flex w-full h-full no-scrollbar">
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            ref={listRef}
                            height={height}
                            width={width}
                            itemCount={filteredAndSortedSongs.length + 1}
                            itemSize={getItemSize}
                            onScroll={handleScroll}
                            itemData={songRowData}
                            itemKey={getItemKey}
                            overscanCount={10}
                            initialScrollOffset={initialScrollOffset}
                        >
                            {SongRowMemo}
                        </List>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
};

export default SongList