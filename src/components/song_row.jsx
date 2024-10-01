import LanguageFlag from "./language_flag";

const month_names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
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
                <div className='flex justify-center align-center'><LanguageFlag language={song.language} /></div>
            </td>
            <td>
                <div>{song.capo}</div>
            </td>
        </tr>
    )
}

export default SongRow;