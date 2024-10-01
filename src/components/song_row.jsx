import LanguageFlag from "./language_flag";
import { Avatar } from "@nextui-org/react";
const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
import { CameraIcon } from "./CameraIcon";
import { CircularProgress } from "@nextui-org/react";

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

function VocalRangeIndicator({ song }) {
    const chromaticScale = {
        "c": 0,
        "c#": 1,
        "db": 1,
        "d": 2,
        "d#": 3,
        "eb": 3,
        "e": 4,
        "f": 5,
        "f#": 6,
        "gb": 6,
        "g": 7,
        "g#": 8,
        "ab": 8,
        "a": 9,
        "a#": 10,
        "bb": 10,
        "b": 11,
        "h": 11
    };
    const maxRange = 24;

    let songRangeSemitones;
    console.log(song)
    if (!song.range.includes("-")) {
        // return <></>
        // song.range = "c1-d3"
        songRangeSemitones = "?"
    } else {
        const songRange = song.range.split("-");
        const octaves = songRange[1].slice([-1]) - songRange[0].slice([-1])
        const lowestTone = songRange[0].slice(0, -1).toLowerCase()
        const highestTone = songRange[1].slice(0, -1).toLowerCase()
        const withinOctave = chromaticScale[highestTone] - chromaticScale[lowestTone]

        // console.log(octaves, withinOctave, 12 * octaves + withinOctave)
        songRangeSemitones = 12 * octaves + withinOctave;
    }

    return (
        <CircularProgress aria-label="vocal range" size="md" value={songRangeSemitones} maxValue={maxRange} color={progressColor(songRangeSemitones)} formatOptions={{ style: "decimal", }} showValueLabel={true} strokeWidth={3} />
    );
}

function SongRow({ song, setSelectedSong }) {
    return (
        <tr onClick={() => { setSelectedSong(song) }} className="p-10 m-10">
            <td>
                <Avatar showFallback src='https://images.unsplash.com/broken' fallback={
                    <CameraIcon className="animate-pulse w-6 h-6 text-default-500" fill="currentColor" size={20} />
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
                    <VocalRangeIndicator song={song} /></div>
            </td>
        </tr>
    )
}

export default SongRow;