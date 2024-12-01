import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate } from "react-router-dom";
import AutoSizer from 'react-virtualized-auto-sizer';
import useLocalStorageState from 'use-local-storage-state';
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types';
import { fetchIllustrationPrompt } from '../../components/song_loader';
import { AutoTextSize } from 'auto-text-size';
import { CircleX } from 'lucide-react';
import './SongGallery.css'
import { Button } from '@/components/ui/button';
// import LazyLoad from 'react-lazyload';
// import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"
import { Masonry } from "masonic";
import { IllustrationPrompt } from '@/components/IllustrationPrompt';

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


// <Card isFooterBlurredHoverable isFooterBlurred 
// >
// </Card>

const SongGallery = () => {
    const songDB = useLoaderData() as SongDB;
    const songs = getShuffledArr(songDB.songs) as Array<SongData>;

    const [windowSize, setWindowSize] = useState(null)

    const MasonryCard = ({ index, data, width }) => (
        <CardThatHides song={data} />
    );

    const columnWidth = () => {
        const breakpoints = [700, 1200, 1800];
        const windowWidth = window.innerWidth;
        for (const i of Array(3).keys()) {
            console.log(i, windowWidth, window.innerWidth)
            if (windowWidth < breakpoints[i]) {
                return windowWidth / (i + 2);
            }
        }
    }

    return (
        <div className='max-w-full m-[10px]'>
            <Masonry items={songs} render={MasonryCard} columnGutter={10} rowGutter={10} columnWidth={columnWidth()} />
        </div>
    );
};

export default SongGallery;
