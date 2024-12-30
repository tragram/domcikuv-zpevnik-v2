import { LanguageCount, SongData, SongDB } from '../types/types'
import * as yaml from 'js-yaml';
import { version } from '@/../package.json';
import { guessKey } from '@/routes/SongView/songRendering';

// Cache keys
const CACHE_KEYS = {
    SONG_DB: "songDB",
    SONG_DB_HASH: "songDB.hash",
    VERSION: "version"
};

export function getBasePath(): string {
    const baseUrl = import.meta.env.BASE_URL
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

export function resolveAssetPath(path: string): string {
    const basePath = getBasePath()
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    // Remove trailing slash from basePath if path is empty
    const finalBasePath = cleanPath ? basePath : basePath.replace(/\/$/, '')
    return `${finalBasePath}${cleanPath}`
}

function fileURL(filename: string): string {
    // Handle absolute URLs (like CDN resources)
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
        return filename
    }
    return resolveAssetPath(filename)
}

function loadFromLocalStorage(key: string): any {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error);
        return null;
    }
}

function saveToLocalStorage(key: string, value: any): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Error saving to localStorage:`, error);
    }
}

function clearSongDBFromLocalStorage() {
    localStorage.removeItem(CACHE_KEYS.SONG_DB);
    localStorage.removeItem(CACHE_KEYS.SONG_DB_HASH);
}

function checkVersion() {
    const currentVersion = version;
    const savedVersion = localStorage.getItem(CACHE_KEYS.VERSION);
    if (currentVersion !== savedVersion) {
        console.log(`New version ${currentVersion} (installed ${savedVersion}). Clearing local storage!`);
        localStorage.clear();
    }
    localStorage.setItem(CACHE_KEYS.VERSION, currentVersion);
}

async function fetchSongs(): Promise<SongDB> {
    checkVersion();

    const savedSongDB = loadFromLocalStorage(CACHE_KEYS.SONG_DB);
    const savedHash = localStorage.getItem(CACHE_KEYS.SONG_DB_HASH);
    const timeOut = savedSongDB ? 1000 : 3000;
    let newHash;
    try {
        const response = await fetch(fileURL('songDB.hash'), { signal: AbortSignal.timeout(timeOut) });
        newHash = await response.text();
    } catch {
        if (savedSongDB) {
            console.log("Failed to load hash but found SongDB in LocalStorage!");
            savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
            return savedSongDB;
        }
        throw new Error('Failed to fetch song hash and no data in LocalStorage!');
    }

    if (savedHash === newHash && savedSongDB) {
        savedSongDB.songs = savedSongDB.songs.map(s => SongData.fromJSON(s));
        return savedSongDB;
    }

    console.log("New DB detected -> Removing old SongDB from LocalStorage!");
    clearSongDBFromLocalStorage();

    const response = await fetch(fileURL("songDB.json"));
    if (!response.ok) {
        throw new Error('Failed to fetch songs');
    }
    try {
        const data = await response.json();
        const songs = data.map(d => new SongData(d));

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

        saveToLocalStorage(CACHE_KEYS.SONG_DB, songDB);
        localStorage.setItem(CACHE_KEYS.SONG_DB_HASH, newHash);
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
    const savedSongHash = localStorage.getItem(contentKey + ".hash");
    let songContent = localStorage.getItem(contentKey);

    if (!songContent || savedSongHash != songData.contentHash) {
        const response = await fetch(fileURL(`songs/chordpro/${songData.chordproFile}`));
        songContent = await response.text();
        localStorage.setItem(contentKey, songContent);
        localStorage.setItem(contentKey + ".hash", songData.contentHash);
    }

    songData.content = songContent;
    // TODO: guess
    if (!songData.key) {
        songData.key = guessKey(songData.content || '')
    }
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

export { fileURL, fetchSongs, fetchSongContent, fetchIllustrationPrompt, DataForSongView };