
import { LanguageCount, SongData } from '../types'


async function fetchSongs(): Promise<SongDB> {
    // load data from localStorage
    let savedSongDB = JSON.parse(localStorage.getItem("songDB"));
    const savedHash = localStorage.getItem("songDB.hash");

    // check hash
    let response = await fetch(import.meta.env.BASE_URL + '/songDB.hash', { signal: AbortSignal.timeout(500) });
    if (!response.ok) {
        if (savedSongDB) {
            console.log("Failed to load hash but found SongDB in LocalStorage!")
            savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
            return savedSongDB;
        }
        else {
            throw new Error('Failed to fetch song hash and DB not saved in LocalStorage!');
        }
    }
    const newHash = await response.text()
    // console.log(savedHash, newHash, savedHash == newHash);
    if (savedHash == newHash) {
        savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
        return savedSongDB;
    } else {
        console.log("New DB detected -> Clearing LocalStorage!")
        localStorage.clear();
    }

    response = await fetch(import.meta.env.BASE_URL + '/songDB.json');
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
    console.log("Fetching song", params.id);
    // this is not the most efficient but the URLs will look great!
    const songDB = await fetchSongs();
    let songData = songDB.songs.find(song => song.id == params.id);
    if (!songData) {
        console.log(`Could not find song ${params.id}`);
        throw new Response("Song not Found", { status: 404 });
    }
    let songContent = localStorage.getItem(songData.chordproFile);
    if (!songContent) {
        let response = await fetch(import.meta.env.BASE_URL + "/songs/chordpro/" + songData.chordproFile);
        songContent = await response.text();
        localStorage.setItem(songData.chordproFile, songContent);
    }
    songData.content = songContent;
    return songData;
}

export { fetchSongs, fetchSongContent };