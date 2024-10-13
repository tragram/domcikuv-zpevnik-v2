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

function VocalRangeIndicator({ song, maxRange }) {

    let songRangeSemitones = song.range.semitones;
    // console.log(song.title, songRangeSemitones,maxRange)
    return (
        <CircularProgress aria-label="vocal range" color={progressColor(songRangeSemitones)} formatOptions={{ style: "decimal", }} maxValue={maxRange} showValueLabel={songRangeSemitones} size="md" strokeWidth={3} value={songRangeSemitones ? songRangeSemitones : maxRange} />
    );
}

interface SongRowProps {
    song: SongData;
    setSelectedSong: any;
    maxRange: number;
}

function SongRow({ song, setSelectedSong, maxRange }: SongRowProps) {
    function decideWhatToShow(song) {
        // if (song.lyricsLength() < 100) {
        //     window.open(import.meta.env.BASE_URL + "/pdfs/"+JSON.parse(song.pdf_filenames.replace(/'/g, '"')).slice(-1),"_blank")
        // } else {
        //     setSelectedSong(song)
        // }
    }
    let navigate = useNavigate();
    const routeChange = (song: SongData) => {
        let path = `song/${song.id}`;
        navigate(path);
    }

    return (
        <div className="flex h-12 song-row w-full" onClick={() => { routeChange(song); }}>
            <div className="flex basis-[12%] min-w-14 rounded-l-full content-center justify-center bg-gray-100 relative pl-5">
                <Avatar className="absolute -left-3 top-0 bottom-0 m-auto song-avatar" fallback={
                    <Instagram size={24} />
                } showFallback size="lg" src={import.meta.env.BASE_URL + "/songs/illustrations/" + song.chordproFile.split('.')[0] + "/FLUX.1-dev.jpg"} />
            </div>
            <div className="flex-auto min-w-48 flex-col bg-gray-100 text-left content-center">
                <h2 className="text-sm font-bold">{song.title}</h2>
                <h3 className="text-sm opacity-50">{song.artist}</h3>
            </div>
            <div className="flex basis-1/6 min-w-12 flex-col content-center justify-center hidden sm:flex text-center bg-gray-100">
                <h3 className="text-xs opacity-70">{month_names[song.dateAdded.month - 1]}</h3>
                <h2 className="text-sm opacity-70">{song.dateAdded.year}</h2>
            </div>
            <div className="basis-1/12 text-center content-center justify-center hidden lg:flex flex-col bg-gray-100">
                <h2 className="text-xs opacity-70">Capo</h2>
                <h3 className="text-sm opacity-70">{song.capo}</h3>
            </div>
            <div className="hidden basis-1/6 sm:flex content-center justify-center bg-gray-100">
                <div className='flex items-center'>
                    <VocalRangeIndicator maxRange={maxRange} song={song} /></div>
            </div>
            <div className="flex basis-1/12 min-w-12 bg-gray-100 rounded-r-full items-center justify-end p-2">
                <LanguageFlag language={song.language} />
            </div>
        </div>
    )
}

export default SongRow;