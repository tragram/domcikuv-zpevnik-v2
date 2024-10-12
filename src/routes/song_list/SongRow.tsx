import { Avatar, CircularProgress, Image } from "@nextui-org/react";
import { Instagram } from "lucide-react";
import LanguageFlag from "./LanguageFlag";
import SongData from "../../components/song_loader";
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
        let path = `song/${song.artist}/${song.title}`;
        navigate(path);
    }

    return (
        <div className="table-row h-12 song-row" onClick={() => { routeChange(song); }}>
            <div className="table-cell rounded-l-full flex content-center justify-center pr-3 bg-gray-100 relative pl-5 w-16">
                <Avatar className="absolute -left-3 top-0 bottom-0 m-auto song-avatar" fallback={
                    <Instagram size={24} />
                } showFallback size="lg" src={import.meta.env.BASE_URL + "/songs/illustrations/" + song.chordproFile.split('.')[0] + "/FLUX.1-dev.jpg"} />
            </div>
            <div className="table-cell flex content-center justify-center bg-gray-100 ">
                <div className="text-left">
                    <h2 className="font-bold">{song.title}</h2>
                    <h3 className="text-sm opacity-50">{song.artist}</h3>
                </div>
            </div>
            <div className="table-cell flex content-center justify-center hidden sm:table-cell text-center bg-gray-100">
                <h2 className="text-sm opacity-70">{song.dateAdded.year}</h2>
                <h3 className="text-xs opacity-70">{month_names[song.dateAdded.month]}</h3>
            </div>
            <div className="content-center justify-center text-center hidden lg:table-cell bg-gray-100">
                <div>{song.capo}</div>
            </div>
            <div className="hidden sm:table-cell flex content-center justify-center bg-gray-100">
                <div className='flex justify-center content-center'>
                    <VocalRangeIndicator maxRange={maxRange} song={song} /></div>
            </div>
            <div className="table-cell flex content-center justify-center bg-gray-100 rounded-r-full">
                <div className='flex justify-center content-center'><LanguageFlag language={song.language} /></div>
            </div>
        </div>
    )
}

export default SongRow;