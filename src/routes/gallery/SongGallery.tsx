import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useLoaderData, useNavigate } from "react-router-dom";
import AutoSizer from 'react-virtualized-auto-sizer';
import { areEqual, FixedSizeList as List } from 'react-window';
import useLocalStorageState from 'use-local-storage-state';
import { FilterSettings, SongData, SongDB, SortField, SortOrder, SortSettings } from '../../types';
import { AnimatePresence, motion, wrap } from 'framer-motion';
import { Card, CardHeader, CardBody, CardFooter, Image, Button, Link, Avatar, Skeleton } from "@nextui-org/react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry"
import { fetchIllustrationPrompt } from '../../components/song_loader';
import { AutoTextSize } from 'auto-text-size';
import { CircleX } from 'lucide-react';

const getShuffledArr = arr => {
    const newArr = arr.slice()
    for (let i = newArr.length - 1; i > 0; i--) {
        const rand = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[rand]] = [newArr[rand], newArr[i]];
    }
    return newArr
};

const imageHeight = (normalHeight, variability) => {
    return normalHeight * (1 - variability + variability * Math.random())
}

function CardThatHides({ song }) {
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

    return (
        <Card className={"w-full show-overlay-hover " + (hidden ? 'hidden' : 'flex')} style={{ height: imageHeightGen }} isHoverable isFooterBlurred onMouseEnter={() => setShowingContent(true)} onClick={() => setShowingContent(true)}
        >
            <div className={"image-overlay absolute flex flex-col items-center before:bg-white/10 border-white/20 border-1 overflow-hidden before:rounded-xl rounded-large shadow-small z-10 backdrop-blur-lg pt-4 justify-start " + ("opacity-" + overlayOpacity)} onMouseEnter={() => setOverlayOpacity(100)} onMouseLeave={() => setOverlayOpacity(0)}>
                <CircleX className='absolute top-4 right-4 w-8 h-8 text-white/60 hover:text-white' onClick={() => setOverlayOpacity(0)} />
                <div >
                    {/* <Avatar showFallback src='https://images.unsplash.com/broken' className='w-full h-full' /> */}
                </div>
                <p className="text-tiny text-white/80 uppercase font-bold">{song.artist}</p>
                <h4 className="text-white font-medium text-large">{song.title}</h4>
                <div className='mx-4 flex flex-grow'>
                    {/* <Skeleton isLoaded={promptContent} className='bg-white/60 opacity-50 m-4 mb-10 rounded-lg '> */}
                        <p className='text-xs text-white mt-4'>{promptContent}</p>
                    {/* </Skeleton> */}
                </div>
                <Button as={Link} href={"/song/" + song.id} className="w-full rounded-t-none bg-white/60 text-white text-md backdrop-blur-sm hover:bg-white">View</Button>
            </div>
            <Image
                // TODO: variable image height by cropping the contents
                onError={onError}
                removeWrapper
                alt="Card background"
                className={"z-0 w-full h-full object-cover"}
                src={import.meta.env.BASE_URL + "/songs/illustrations/" + song.chordproFile.split('.')[0] + `/${song.illustration_author}.webp`}
            />
        </Card>
    )
}

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
