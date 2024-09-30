import getUnicodeFlagIcon from 'country-flag-icons/unicode'
import {
    CZ,
    GB,
    DE,
    GE,
    PL,
    UY,
    RO,
    FI,
    EE,
    FR,
    IM,
} from 'country-flag-icons/react/3x2'

const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const language2flag = {
    "czech": <CZ className='w-5 h-5'/>,
    "english": <GB className='w-5 h-5'/>,
    "german": <DE className='w-5 h-5'/>,
    "slovak": <GE className='w-5 h-5'/>,
    "polish": <PL className='w-5 h-5'/>,
    "spanish": <UY className='w-5 h-5'/>,
    "romanian": <RO className='w-5 h-5'/>,
    "finnish": <FI className='w-5 h-5'/>,
    "estonian": <EE className='w-5 h-5'/>,
    "french": <FR className='w-5 h-5'/>,
}

function convert2flag(language) {
    if (language in language2flag) {
        return language2flag[language];
    }
    else {
        return <p>{getUnicodeFlagIcon('IM')}</p>;
    }
}
function SongRow({ song, setSelectedSong }) {
    return (
        <tr onClick={() => { setSelectedSong(song) }}>
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
                <div className='flex justify-center align-center'>{convert2flag(song.language)}</div>
            </td>
            <td>
                <div>{song.capo}</div>
            </td>
        </tr>
    )
}

export default SongRow;