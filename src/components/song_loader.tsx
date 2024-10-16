
import { LanguageCount, SongData } from '../types'


async function fetchSongs(): Promise<SongDB> {
    // load data from localStorage
    let savedSongDB = JSON.parse(localStorage.getItem("songDB"));
    const savedHash = localStorage.getItem("songDB.hash");

    // have a more lenient timeout when the data is not available
    const timeOut = savedSongDB ? 1000 : 3000;
    let newHash;
    // check hash
    try {
        let response = await fetch(import.meta.env.BASE_URL + '/songDB.hash', { signal: AbortSignal.timeout(timeOut) });
        newHash = await response.text()
    } catch {
        if (savedSongDB) {
            console.log("Failed to load hash but found SongDB in LocalStorage!")
            savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
            return savedSongDB;
        }
        else {
            throw new Error('Failed to fetch song hash and DB not saved in LocalStorage!');
        }
    }
    // console.log(savedHash, newHash, savedHash == newHash);
    if (savedHash == newHash) {
        savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
        return savedSongDB;
    } else {
        console.log("New DB detected -> Clearing LocalStorage!")
        // remove any songDB from localstorage (this deletes the individual songs too - just in case)
        Object.keys(localStorage)
            .filter(x =>
                x.startsWith('songDB'))
            .forEach(x =>
                localStorage.removeItem(x))
    }

    const response = await fetch(import.meta.env.BASE_URL + '/songDB.json');
    if (!response.ok) {
        throw new Error('Failed to fetch songs');
    }
    try {
        const data = await response.json();
        const songs = data.map(d => new SongData(d));
        let languages: LanguageCount = {};
        songs.forEach(song => {
            languages[song.language] = (languages[song.language] || 0) + 1;
        });
        // TODO: languages with less than e.g. 5 songs should be merged into "other"
        const songRanges = songs.map(s => s.range.semitones).filter(s => s);
        const songDB = {
            maxRange: Math.max(...songRanges),
            languages: languages,
            songs: songs,
        }
        localStorage.setItem("songDB", JSON.stringify(songDB));
        localStorage.setItem("songDB.hash", newHash);
        return songDB;
    } catch (error) {
        console.error('Error fetching songs:', error);
        throw error;
    }

}

async function fetchSongContent({ params }) {
    // this is not the most efficient but the URLs will look great!
    const songDB = await fetchSongs();
    let songData = songDB.songs.find(song => song.id == params.id);
    if (!songData) {
        console.log(`Could not find song ${params.id}`);
        throw new Response("Song not Found", { status: 404 });
    }
    let songContent = localStorage.getItem("songDB/" + songData.chordproFile);
    if (!songContent) {
        let response = await fetch(import.meta.env.BASE_URL + "/songs/chordpro/" + songData.chordproFile);
        songContent = await response.text();
        localStorage.setItem("songDB/" + songData.chordproFile, songContent);
    }
    songData.content = songContent;
    return songData;
}

export { fetchSongs, fetchSongContent };