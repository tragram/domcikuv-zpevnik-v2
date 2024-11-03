import { Avatar } from "@/components/ui/avatar";
import { SongData } from "../../types";
import { Instagram } from "lucide-react";
import { AvatarImage } from "@radix-ui/react-avatar";
const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
import {
    useHref,
    useLinkClickHandler,
} from "react-router-dom";
import LanguageFlag from "@/components/LanguageFlag";
import CircularProgress from "@/components/ui/circular-progress";

function progressColor(range) {
    if (!range) {
        return "default";
    }
    if (range < 12) {
        return "success";
    } else if (range < 18) {
        return "warning";
    } else {
        return "danger";
    }
}


interface VocalRangeIndicatorProps {
    song: SongData;
    maxRange: number;
}

function VocalRangeIndicator({ song, maxRange }: VocalRangeIndicatorProps) {
    const songRangeSemitones = song.range.semitones;
    return (
        <CircularProgress
            value={songRangeSemitones} maxValue={maxRange} color={"#FF0000"}
        />
    )
}

interface SongRowProps {
    song: SongData;
    setSelectedSong: any;
    maxRange: number;
}

function SongRow({ song, setSelectedSong, maxRange }: SongRowProps) {
    const handleClick = useLinkClickHandler(song.url(), {
        // replace,
        // state,
        // target,
    });
    if (!song) {
        console.log("Invalid song!")
        return (
            <div className="h-[70px] flex items-center container max-w-2xl mx-auto px-4 bg-white text-black">Invalid song</div>
        )
    }
    console.log(song.thumbnailURL())
    return (
        <div className="h-[70px] flex items-center container max-w-2xl mx-auto px-4">
            <div className="flex h-14 min-w-72 w-full rounded-full song-row-bg-image" style={{ backgroundImage: `url(${song.thumbnailURL()})` }}
                onClick={(event) => handleClick(event)}>
                <div className="flex relative h-full w-full items-center rounded-full p-1 backdrop-blur-md song-row-bg-image shadow-black row-text-shadow" >
                    <Avatar className="absolute -left-1 top-0 bottom-0 m-auto song-avatar z-10 w-16 h-16 text-large" ><AvatarImage src={song.thumbnailURL()} /></Avatar>
                    <div className="flex relative h-12 song-row w-full backdrop-blur-lg bg-white/70 hover:bg-white/90 dark:bg-black/70 rounded-full">
                        <div className="flex basis-[12%] min-w-[72px] rounded-l-full content-center justify-center relative">
                        </div>
                        <div className="flex-auto min-w-40 flex-col text-left content-center">
                            <h2 className="text-sm font-bold truncate">{song.title}</h2>
                            <h3 className="text-sm opacity-50 truncate">{song.artist}</h3>
                        </div>
                        <div className="flex basis-1/6 min-w-12 flex-col content-center justify-center hidden sm:flex text-center">
                            <h3 className="text-xs opacity-70">{month_names[song.dateAdded.month - 1]}</h3>
                            <h2 className="text-sm opacity-70">{song.dateAdded.year}</h2>
                        </div>
                        <div className="basis-1/12 text-center content-center justify-center hidden lg:flex flex-col">
                            <h2 className="text-xs opacity-70">Capo</h2>
                            <h3 className="text-sm opacity-70">{song.capo}</h3>
                        </div>
                        <div className="hidden basis-[10%] sm:flex content-center justify-center">
                            <div className='flex items-center'>
                                <VocalRangeIndicator song={song} maxRange={maxRange} />
                            </div>
                            <div className="flex basis-1/12 min-w-12 items-center justify-end p-2">
                                <LanguageFlag language={song.language} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SongRow;