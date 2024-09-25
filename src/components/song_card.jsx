function SongCard({ song }) {
    return (
        <div className="w-full p-2 border border-primary flex rounded" onClick={()=>{console.log(song.title)}}>
            <div className="w-6/12">
                <h2 className="font-bold">{song.title}</h2>
                <h3 className="text-sm opacity-50">{song.artist}</h3>
            </div>
            <div className="divider divider-horizontal"></div>
        </div>
    )
}

export default SongCard;