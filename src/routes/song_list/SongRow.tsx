import { Avatar, CircularProgress, Image } from "@nextui-org/react";
import { Instagram } from "lucide-react";
import LanguageFlag from "./LanguageFlag";
import { SongData } from "../../types";
import { useNavigate } from "react-router-dom";

const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
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
    let songRangeSemitones = song.range.semitones;
    return (
        <CircularProgress aria-label="vocal range" color={progressColor(songRangeSemitones)} formatOptions={{ style: "decimal", }} maxValue={maxRange} showValueLabel={!!songRangeSemitones} size="md" strokeWidth={3} value={songRangeSemitones ? songRangeSemitones : maxRange} />
    );
}

interface SongRowProps {
    song: SongData;
    setSelectedSong: any;
    maxRange: number;
}

function SongRow({ song, setSelectedSong, maxRange }: SongRowProps) {
    return (
        <div className="h-[60px] flex items-center container max-w-2xl mx-auto px-4 bottom-0">
            <div className="flex h-12 song-row w-full pl-3" onClick={() => { setSelectedSong(song); }}>
                <div className="flex basis-[12%] min-w-14 rounded-l-full content-center justify-center bg-gray-100 relative">
                    <Avatar className="absolute -left-3 top-0 bottom-0 m-auto song-avatar" fallback={
                        <Instagram size={24} />
                    } showFallback size="lg" src={import.meta.env.BASE_URL + "/songs/illustrations/" + song.chordproFile.split('.')[0] + `/${song.illustration_author}.webp`} />
                </div>
                <div className="flex-auto min-w-48 flex-col bg-gray-100 text-left content-center">
                    <h2 className="text-sm font-bold truncate">{song.title}</h2>
                    <h3 className="text-sm opacity-50 truncate">{song.artist}</h3>
                </div>
                <div className="flex basis-1/6 min-w-12 flex-col content-center justify-center hidden sm:flex text-center bg-gray-100">
                    <h3 className="text-xs opacity-70">{month_names[song.dateAdded.month - 1]}</h3>
                    <h2 className="text-sm opacity-70">{song.dateAdded.year}</h2>
                </div>
                <div className="basis-1/12 text-center content-center justify-center hidden lg:flex flex-col bg-gray-100">
                    <h2 className="text-xs opacity-70">Capo</h2>
                    <h3 className="text-sm opacity-70">{song.capo}</h3>
                </div>
                <div className="hidden basis-[10%] sm:flex content-center justify-center bg-gray-100">
                    <div className='flex items-center'>
                        <VocalRangeIndicator song={song} maxRange={maxRange} /></div>
                </div>
                <div className="flex basis-1/12 min-w-12 bg-gray-100 rounded-r-full items-center justify-end p-2">
                    <LanguageFlag language={song.language} />
                </div>
            </div>
        </div>
    )
}

export default SongRow;