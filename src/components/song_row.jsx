import { Avatar, CircularProgress } from "@nextui-org/react";
import { Instagram } from "lucide-react";
import LanguageFlag from "./language_flag";
const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function progressColor(range) {
    if (range == "?") {
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
    return (
        <CircularProgress aria-label="vocal range" color={progressColor(songRangeSemitones)} formatOptions={{ style: "decimal", }} maxValue={maxRange} showValueLabel={true} size="md" strokeWidth={3} value={songRangeSemitones} />
    );
}

function SongRow({ song, setSelectedSong, maxRange = { maxRange } }) {
    return (
        <div className="table-row h-14" onClick={() => { setSelectedSong(song) }}>
            <div className="table-cell flex content-center justify-center">
                <Avatar fallback={
                    <Instagram size={24} />
                } showFallback src='https://images.unsplash.com/broken' />
            </div>
            <div className="table-cell flex content-center justify-center">
                <div className="text-left">
                    <h2 className="font-bold">{song.title}</h2>
                    <h3 className="text-sm opacity-50">{song.artist}</h3>
                </div>
            </div>
            <div className="table-cell flex content-center justify-center hidden sm:flex">
                <div className="text-center">
                    <h2 className="text-sm opacity-70">{song.date_added.split("-")[1]}</h2>
                    <h3 className="text-xs opacity-70">{month_names[parseInt(song.date_added.split("-")[0])]}</h3>
                </div>
            </div>
            <div className="table-cell flex content-center justify-center">
                <div className='flex justify-center content-center'><LanguageFlag language={song.language} /></div>
            </div>
            <div className="table-cell flex content-center justify-center text-center  hidden lg:flex">
                <div>{song.capo}</div>
            </div>
            <div className="table-cell flex content-center justify-center">
                <div className='flex justify-center content-center'>
                    <VocalRangeIndicator maxRange={maxRange} song={song} /></div>
            </div>
        </div>
    )
}

export default SongRow;