import { IllustrationPopup } from "@/components/IllustrationPopup";
import LanguageFlag from "@/components/LanguageFlag";
import CircularProgress from "@/components/ui/circular-progress";
import { Link } from "react-router-dom";
import { SongData } from "../../types/types";
import { memo } from "react";
import { cn } from "@/lib/utils";


export const SONG_ROW_HEIGHT_PX = 70;

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
] as const;

interface VocalRangeIndicatorProps {
    songRangeSemitones: number | undefined;
    maxRange: number;
}

const VocalRangeIndicator = memo(({ songRangeSemitones, maxRange }: VocalRangeIndicatorProps) => (
    songRangeSemitones ? <CircularProgress value={songRangeSemitones || maxRange} maxValue={maxRange} /> : <div><CircularProgress value={songRangeSemitones || maxRange} maxValue={maxRange} /></div >
));


interface DateDisplayProps {
    month: number;
    year: number;
}

const DateDisplay = memo(({ month, year }: DateDisplayProps) => (
    <div className="basis-[13%] min-w-12 flex-col content-center justify-center hidden sm:flex text-center">
        <h3 className="text-xs opacity-70">{MONTH_NAMES[month - 1]}</h3>
        <h2 className="text-sm opacity-70">{year}</h2>
    </div>
));


interface CapoDisplayProps {
    capo: number;
}

const CapoDisplay = memo(({ capo }: CapoDisplayProps) => (
    <div className="basis-[13%] flex-shrink min-w-12 text-center content-center justify-center hidden lg:flex flex-col">
        <h2 className="text-xs opacity-70">Capo</h2>
        <h3 className="text-sm opacity-70">{capo}</h3>
    </div>
));

interface SongInfoProps {
    title: string;
    artist: string;
}

const SongInfo = memo(({ title, artist }: SongInfoProps) => (
    <div className="flex-auto basis-1/2 min-w-40 flex-col text-left content-center">
        <h2 className="text-sm font-bold truncate song-title">{title}</h2>
        <h3 className="text-sm opacity-50 truncate song-artist">{artist}</h3>
    </div>
));

interface SongRowProps {
    song: SongData;
    maxRange: number;
    loadImage?: boolean;
}

const SongRow = memo(({ song, maxRange }: SongRowProps) => {

    if (!song) {
        console.error("Invalid song provided to SongRow");
        return (
            <div className="h-[70px] flex items-center container max-w-2xl mx-auto px-2 sm:px-4 bg-white text-foreground">
                Invalid song
            </div>
        );
    }

    return (
        <div className={cn(`h-[${SONG_ROW_HEIGHT_PX}px]`, "flex items-center container max-w-2xl mx-auto px-2 sm:px-4 song-row-wrapper")}>
            <div
                className="flex h-14 min-w-72 w-full rounded-full song-row-bg-image"
                style={{ backgroundImage: `url(${song.thumbnailURL()})` }}>
                <div className="flex relative h-full w-full items-center rounded-full p-1 backdrop-blur-md song-row-bg-image shadow-black row-text-shadow">
                    <IllustrationPopup
                        avatarClassName="absolute -left-0 top-0 bottom-0 m-auto song-avatar z-10 w-16 h-16 text-large"
                        song={song}
                    />
                    <Link to={song.url()} className="flex relative h-12 song-row w-full backdrop-blur-lg bg-glass/60 hover:bg-glass/90 rounded-full">
                        <div className="flex min-w-[72px] rounded-l-full content-center justify-center relative" />
                        <SongInfo title={song.title} artist={song.artist} />

                        <DateDisplay
                            month={song.dateAdded.month}
                            year={song.dateAdded.year}
                        />

                        <CapoDisplay capo={song.capo} />

                        <div className="hidden basis-[13%] min-w-12 sm:flex content-center justify-center">
                            <div className="flex items-center">
                                <VocalRangeIndicator
                                    songRangeSemitones={song.range.semitones}
                                    maxRange={maxRange}
                                />
                            </div>
                        </div>

                        <div className="flex basis-1/12 min-w-12 items-center justify-end p-2">
                            <LanguageFlag language={song.language} />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
});


export default SongRow;