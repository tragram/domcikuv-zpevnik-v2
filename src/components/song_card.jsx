function SongCard({ song, setSelectedSong }) {
    return (
        <div className="w-full p-2 border border-primary flex rounded" onClick={() => { setSelectedSong(song) }}>
            <div className="w-6/12">
                <h2 className="font-bold">{song.title}</h2>
                <h3 className="text-sm opacity-50">{song.artist}</h3>
            </div>
            <div className="divider divider-horizontal"></div>
            <div>{song.date_added}</div>
            <div className="divider divider-horizontal"></div>
            <div>{song.language}</div>
            <div className="divider divider-horizontal"></div>
            <div>{song.capo}</div>
        </div>
    )
}

export default SongCard;