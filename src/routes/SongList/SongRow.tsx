import { IllustrationPopup } from "@/components/IllustrationPopup";
import LanguageFlag from "@/components/LanguageFlag";
import CircularProgress from "@/components/ui/circular-progress";
import { Link } from "react-router-dom";
import { SongData } from "../../types/types";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { songBooksWAvatars } from "@/components/songbookAvatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export const SONG_ROW_HEIGHT_PX = 70;

interface SongInfoProps {
    title: string;
    artist: string;
    className?: string;
}

const SongInfo = memo(({ title, artist, className = "" }: SongInfoProps) => (
    <div className={cn("min-w-40 flex-col text-left content-center", className)}>
        <h2 className="text-sm font-bold truncate song-title">{title}</h2>
        <h3 className="text-sm opacity-50 truncate song-artist">{artist}</h3>
    </div>
));

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
] as const;


interface DateDisplayProps {
    month: number;
    year: number;
    className?: string;
}

const DateDisplay = memo(({ month, year, className = "" }: DateDisplayProps) => (
    <div className={cn("min-w-20 flex-col content-center justify-center text-center", className)}>
        <h3 className="text-xs opacity-70">{MONTH_NAMES[month - 1]}</h3>
        <h2 className="text-sm opacity-70">{year}</h2>
    </div>
));

interface VocalRangeIndicatorProps {
    songRangeSemitones: number | undefined;
    maxRange: number;
    className?: string;
}

interface CapoDisplayProps {
    capo: number;
    className?: string;
}

const CapoDisplay = memo(({ capo, className = "" }: CapoDisplayProps) => (
    <div className={cn("min-w-12 text-center content-center justify-center flex-col", className)}>
        <h2 className="text-xs opacity-70">Capo</h2>
        <h3 className="text-sm opacity-70">{capo}</h3>
    </div>
));


const VocalRangeIndicator = memo(({ songRangeSemitones, maxRange, className = "" }: VocalRangeIndicatorProps) => {
    const innerHTML = songRangeSemitones ? <CircularProgress value={songRangeSemitones || maxRange} maxValue={maxRange} /> : <></>;
    return (

        <div className={cn("min-w-12 content-center justify-center", className)}>
            <div className="flex items-center">
                {innerHTML}
            </div>
        </div>

    )
});


interface SongbookAvatarsProps {
    songbooks: string[];
    maxAvatars?: number;
    overlapPercent?: number;
    className?: string;
}

const SongBookAvatars = memo(({ songbooks, maxAvatars = 3, overlapPercent = 50, className = "" }: SongbookAvatarsProps) => {
    const songbooksWithAvatars = songBooksWAvatars(songbooks);
    const displaySongbooks = songbooksWithAvatars.slice(0, maxAvatars)
    const remainingCount = songbooksWithAvatars.length - maxAvatars

    return (
        <div className={cn("min-w-20 items-center justify-center", className)}>
            <div className="flex w-full h-full items-center">
                {displaySongbooks.map((songbook, index) => (
                    <div
                        key={index}
                        className={cn("relative h-10 w-10 rounded-full border-2 border-background", index > 0 ? " -ms-4" : "")}
                    >
                        <Avatar className={"h-full w-full"}>
                            <AvatarImage src={songbook.avatar} alt={songbook.value + " avatar"} />
                            <AvatarFallback>{songbook.avatar_fallback}</AvatarFallback>
                        </Avatar>
                    </div>
                ))}
                {remainingCount > 0 && (
                    <div
                        className="relative rounded-full border-2 border-background flex items-center justify-center bg-muted -ms-2"
                    >
                        <Avatar className={""}>
                            <AvatarFallback>+{remainingCount}</AvatarFallback>
                        </Avatar>
                    </div>
                )}
            </div>
        </div>
    )
})

interface SongRowProps {
    song: SongData;
    maxRange: number;
    loadImage?: boolean;
}

const SongRow = memo(({ song, maxRange }: SongRowProps) => {

    if (!song) {
        console.error("Invalid song provided to SongRow");
        return (
            <div className="h-[70px] flex items-center container max-w-3xl mx-auto px-2 sm:px-4 bg-white text-foreground">
                Invalid song
            </div>
        );
    }

    return (
        <div className={cn(`h-[${SONG_ROW_HEIGHT_PX}px]`, "flex items-center container max-w-3xl mx-auto px-2 sm:px-4 song-row-wrapper")}>
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

                        <SongInfo title={song.title} artist={song.artist} className="flex-auto" />

                        <SongBookAvatars songbooks={song.songbooks} className="hidden sm:flex basis-[13%] shrink-0" />
                        <DateDisplay
                            month={song.dateAdded.month}
                            year={song.dateAdded.year}
                            className="hidden xsm:flex md:basis-1/12 shrink-0 basis-[2/12]"
                        />

                        <CapoDisplay capo={song.capo} className="hidden lg:flex basis-1/12 shrink-0" />

                        <VocalRangeIndicator
                            songRangeSemitones={song.range.semitones}
                            maxRange={maxRange}
                            className="hidden md:flex basis-1/12 shrink-0"
                        />

                        <div className="flex basis-[5%] min-w-10 shrink-0 items-center justify-end p-2">
                            <LanguageFlag language={song.language} />
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
});


export default SongRow;