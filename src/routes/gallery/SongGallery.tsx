import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate } from "react-router-dom";
import AutoSizer from 'react-virtualized-auto-sizer';
import useLocalStorageState from 'use-local-storage-state';
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types';
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"
import { fetchIllustrationPrompt } from '../../components/song_loader';
import { AutoTextSize } from 'auto-text-size';
import { CircleX } from 'lucide-react';
import './SongGallery.css'
import { Button } from '@/components/ui/button';

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
    const [promptContent, setPromptContent] = useState(null);
    const [imageHeightGen, setImageHeightGen] = useState(null);
    const [overlayOpacity, setOverlayOpacity] = useState(0);

    useEffect(() => {
        setImageHeightGen(imageHeight(512, 0.3));
    }, [])

    useEffect(() => {
        const fetchPrompt = async () => {
            const promptContent = await fetchIllustrationPrompt(song.id);
            // console.log(promptContent)
            setPromptContent(promptContent[0].response);
        }
        if (showingContent && !promptContent) { fetchPrompt(); }
    }, [showingContent]);

    return (<>
        <div className={"w-full relative " + (hidden ? 'hidden' : 'flex')} style={{ height: imageHeightGen }} >
            <div className="flex w-full rounded-lg image-overlay" style={{ backgroundImage: `url(${song.illustrationURL()})` }}>
            </div>
            <div className={"image-overlay absolute  before:bg-white/10 border-white/20 border-1 overflow-hidden rounded-lg z-10 backdrop-blur-lg bg-glass/30 " + ("opacity-" + overlayOpacity)} onMouseOver={() => setOverlayOpacity(100)} onMouseOut={() => setOverlayOpacity(0)}
                onMouseEnter={() => setShowingContent(true)} onClick={() => setShowingContent(true)}>
                <div className='w-full h-full flex flex-col items-center justify-start pt-4 overflow-hidden '>

                    <CircleX className='absolute top-4 right-4 w-8 h-8 text-white/80 hover:text-white' onClick={() => setOverlayOpacity(0)} />
                    <h2 className="text-tiny text-white/60 uppercase font-bold">{song.artist}</h2>
                    <h2 className="text-white font-medium text-large">{song.title}</h2>
                    <div className='px-4 flex flex-grow h-32 my-4 w-full'>
                        <AutoTextSize mode="boxoneline">
                            <p className='text-foreground text-wrap max-h-full w-full'>{promptContent}</p>
                        </AutoTextSize>
                    </div>
                    <Button onClick={() => navigate(song.url())} className="w-full rounded-t-none bg-primary/60 text-white text-md backdrop-blur-sm hover:bg-white hover:text-primary">View</Button>
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

    return (
        <div className='max-w-full m-[10px]'>
            <ResponsiveMasonry
                columnsCountBreakPoints={{ 350: 1, 700: 2, 1200: 3, 1800: 4 }}
            >
                <Masonry className="image-masonry" gutter="10px">
                    {songs.map(song =>
                        <CardThatHides song={song} key={song.id} />
                    )}
                </Masonry>
            </ResponsiveMasonry>
        </div>
    );
};

export default SongGallery;
