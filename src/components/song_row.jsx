import LanguageFlag from "./language_flag";
import { Avatar } from "@nextui-org/react";
const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
import { CircularProgress } from "@nextui-org/react";
import { Instagram } from "lucide-react";
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
        <CircularProgress aria-label="vocal range" size="md" value={songRangeSemitones} maxValue={maxRange} color={progressColor(songRangeSemitones)} formatOptions={{ style: "decimal", }} showValueLabel={true} strokeWidth={3} />
    );
}

function SongRow({ song, setSelectedSong, maxRange = { maxRange } }) {
    return (
        <tr onClick={() => { setSelectedSong(song) }} className="p-10 m-10">
            <td>
                <Avatar showFallback src='https://images.unsplash.com/broken' fallback={
                    <Instagram size={24} />
                } />
            </td>
            <th>
                <div className="text-left">
                    <h2 className="font-bold">{song.title}</h2>
                    <h3 className="text-sm opacity-50">{song.artist}</h3>
                </div>
            </th>
            <td>
                <div className="text-center">
                    <h2 className="text-sm opacity-70">{song.date_added.split("-")[1]}</h2>
                    <h3 className="text-xs opacity-70">{month_names[parseInt(song.date_added.split("-")[0])]}</h3>
                </div>
            </td>
            <td>
                <div className='flex justify-center align-center'><LanguageFlag language={song.language} /></div>
            </td>
            <td>
                <div>{song.capo}</div>
            </td>
            <td>
                <div className='flex justify-center align-center'>
                    <VocalRangeIndicator song={song} maxRange={maxRange} /></div>
            </td>
        </tr>
    )
}

export default SongRow;