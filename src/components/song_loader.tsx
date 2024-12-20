
import { LanguageCount, SongData, SongDB } from '../types'
import * as yaml from 'js-yaml';
import {version} from '@/../package.json';
function loadFromLocalStorage(key: string): any {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
}

function saveToLocalStorage(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
}

function clearSongDBFromLocalStorage() {
    localStorage.removeItem("songDB");
    localStorage.removeItem("songDB.hash");
}

function checkVersion() {
    const currentVersion = version;
    const savedVersion = localStorage.getItem("version");
    if (currentVersion != savedVersion) {
        console.log(`New version ${currentVersion} (installed ${savedVersion}). Clearing local storage!`)
        localStorage.clear();
    }
    localStorage.setItem("version", currentVersion);
}

async function fetchSongs(): Promise<SongDB> {
    checkVersion();

    const savedSongDB = loadFromLocalStorage("songDB");
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
        const languages: LanguageCount = {};
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

interface DataForSongView {
    songDB: SongDB,
    songData: SongData
}

async function fetchSongContent({ params }): Promise<DataForSongView> {
    const songDB = await fetchSongs();
    const songData = songDB.songs.find(song => song.id === params.id);

    if (!songData) {
        console.log(`Could not find song ${params.id}`);
        throw new Response("Song not Found", { status: 404 });
    }

    const contentKey = `songDB/${songData.id}`;
    const savedSongHash = localStorage.getItem(contentKey + ".hash")

    let songContent = localStorage.getItem(contentKey);

    if (!songContent || savedSongHash != songData.contentHash) {
        const response = await fetch(`${import.meta.env.BASE_URL}/songs/chordpro/${songData.chordproFile}`);
        songContent = await response.text();
        localStorage.setItem(contentKey, songContent);
        localStorage.setItem(contentKey + ".hash", songData.contentHash);
    }

    songData.content = songContent;
    return { songDB: songDB, songData: songData };
}

async function fetchIllustrationPrompt(id: string): Promise<object> {
    const promptKey = `songs/image_prompts/${id}`;
    let promptContent = localStorage.getItem(promptKey);
    if (!promptContent) {
        const response = await fetch(SongData.promptURL(id));
        promptContent = await response.text();
        localStorage.setItem(promptKey, promptContent);
    }
    return yaml.load(promptContent);
}


export { fetchSongs, fetchSongContent, fetchIllustrationPrompt, DataForSongView };