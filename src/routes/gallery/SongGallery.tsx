import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate, useLocation } from "react-router-dom";
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types/types';
import { CircleX } from 'lucide-react';
import './SongGallery.css'
import { Button } from '@/components/ui/button';
import { Masonry } from "masonic";
import { IllustrationPrompt } from '@/components/IllustrationPrompt';

// Move shuffle function outside component to avoid re-shuffling on every render
const getShuffledArr = arr => {
    const newArr = arr.slice()
    for (let i = newArr.length - 1; i > 0; i--) {
        const rand = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[rand]] = [newArr[rand], newArr[i]];
    }
    return newArr
};

const imageHeight = (normalHeight: number, variability: number) => {
    return normalHeight * (1 - variability + variability * Math.random());
}

function CardThatHides({ song }) {
    const navigate = useNavigate();
    const [hidden, setHidden] = useState(false);
    const [showingContent, setShowingContent] = useState(false);
    const onError = () => { console.log("Error showing image in gallery!"); setHidden(true) };
    const [imageHeightGen, setImageHeightGen] = useState(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0);

    useEffect(() => {
        setImageHeightGen(imageHeight(512, 0.3));
    }, [])

    return (<>
        <div className={"w-full relative " + (hidden ? 'hidden' : 'flex')} style={{ height: imageHeightGen }} >
            <div className="background-image flex w-full rounded-lg" onError={onError} style={{ backgroundImage: `url("${song.illustrationURL()}")` }}>
            </div>
            <div className={"image-overlay absolute overflow-hidden rounded-lg z-10 border border-1 border-glass/30 backdrop-blur-lg bg-primary/30 " + ("opacity-" + overlayOpacity)} onMouseOver={() => setOverlayOpacity(100)} onMouseOut={() => setOverlayOpacity(0)}
                onMouseEnter={() => setShowingContent(true)} onClick={() => setShowingContent(true)}>
                <div className='w-full h-full flex flex-col items-center justify-start pt-4 overflow-hidden '>
                    <CircleX className='absolute top-4 right-4 w-8 h-8 text-white/80 hover:text-white' onClick={() => setOverlayOpacity(0)} />
                    <h2 className="text-tiny text-white/90 font-bold uppercase text-shadow">{song.artist}</h2>
                    <h2 className="text-white font-bold text-shadow">{song.title}</h2>
                    <IllustrationPrompt song={song} show={showingContent} className={"text-white h-32"}/>
                    <Button onClick={() => navigate(song.url())} className={"w-full rounded-t-none bg-primary text-white text-md backdrop-blur-sm hover:bg-background hover:text-primary" + (showingContent ? "" : " hidden")}>View</Button>
                </div>
            </div>
        </div>
    </>
    )
}

const SongGallery = memo(() => {
    const songDB = useLoaderData() as SongDB;
    const location = useLocation();
    
    // Use useMemo to prevent reshuffling on every render
    const shuffledSongs = useMemo(() => {
        // Create a stable key for the current route to ensure consistent shuffling
        // This is important when navigating back to this page
        const key = location.key || 'default';
        
        // Use sessionStorage to persist the shuffled order during the session
        const cachedSongs = sessionStorage.getItem(`shuffled-songs-${key}`);
        if (cachedSongs) {
            // Properly recreate SongData objects with their methods
            return JSON.parse(cachedSongs).map(songJson => SongData.fromJSON(songJson));
        }
        
        const shuffled = getShuffledArr(songDB.songs);
        sessionStorage.setItem(`shuffled-songs-${key}`, JSON.stringify(shuffled));
        return shuffled;
    }, [songDB.songs, location.key]);

    // Memoize the column width calculation to prevent unnecessary recalculations
    const getColumnWidth = useMemo(() => {
        return () => {
            const breakpoints = [700, 1200, 1800];
            const windowWidth = window.innerWidth;
            for (const i of Array(3).keys()) {
                if (windowWidth < breakpoints[i]) {
                    return windowWidth / (i + 2);
                }
            }
            return windowWidth / 5; // Default for large screens
        };
    }, []);

    // Memoize the card renderer to prevent unnecessary recreations
    const MasonryCard = useMemo(() => {
        return ({ index, data, width }) => (
            <CardThatHides song={data} />
        );
    }, []);

    return (
        <div className='max-w-full m-[10px]'>
            <Masonry 
                items={shuffledSongs} 
                render={MasonryCard} 
                columnGutter={10} 
                rowGutter={10} 
                columnWidth={getColumnWidth()} 
            />
        </div>
    );
});

export default SongGallery;