
import { LanguageCount, SongData, SongDB } from '../types'

function loadFromLocalStorage(key: string): any {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
}

function saveToLocalStorage(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
}

function clearSongDBFromLocalStorage() {
    Object.keys(localStorage)
        .filter(key => key.startsWith('songDB'))
        .forEach(key => localStorage.removeItem(key));
}

async function fetchSongs(): Promise<SongDB> {
    let savedSongDB = loadFromLocalStorage("songDB");
    const savedHash = localStorage.getItem("songDB.hash");
    const timeOut = savedSongDB ? 1000 : 3000;
    let newHash;

    // Fetch the hash
    try {
        const response = await fetch(`${import.meta.env.BASE_URL}/songDB.hash`, { signal: AbortSignal.timeout(timeOut) });
        newHash = await response.text();
    } catch {
        if (savedSongDB) {
            console.log("Failed to load hash but found SongDB in LocalStorage!");
            savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
            return savedSongDB;
        }
        throw new Error('Failed to fetch song hash and no data in LocalStorage!');
    }

    if (savedHash === newHash) {
        savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
        return savedSongDB;
    }

    console.log("New DB detected -> Clearing LocalStorage!");
    clearSongDBFromLocalStorage();

    const response = await fetch(`${import.meta.env.BASE_URL}/songDB.json`);
    if (!response.ok) {
        throw new Error('Failed to fetch songs');
    }

    try {
        const data = await response.json();
        const songs = data.map(d => new SongData(d));

        // Count languages
        let languages: LanguageCount = {};
        songs.forEach(song => {
            languages[song.language] = (languages[song.language] || 0) + 1;
        });

        const songRanges = songs.map(s => s.range?.semitones).filter(Boolean);
        const songDB = {
            maxRange: Math.max(...songRanges),
            languages,
            songs
        };

        saveToLocalStorage("songDB", songDB);
        localStorage.setItem("songDB.hash", newHash);
        return songDB;
    } catch (error) {
        console.error('Error parsing song data:', error);
        throw error;
    }
}

async function fetchSongContent({ params }): Promise<SongData> {
    const songDB = await fetchSongs();
    const songData = songDB.songs.find(song => song.id === params.id);

    if (!songData) {
        console.log(`Could not find song ${params.id}`);
        throw new Response("Song not Found", { status: 404 });
    }

    const contentKey = `songDB/${songData.chordproFile}`;
    let songContent = localStorage.getItem(contentKey);

    if (!songContent) {
        const response = await fetch(`${import.meta.env.BASE_URL}/songs/chordpro/${songData.chordproFile}`);
        songContent = await response.text();
        localStorage.setItem(contentKey, songContent);
    }

    songData.content = songContent;
    return songData;
}


export { fetchSongs, fetchSongContent };