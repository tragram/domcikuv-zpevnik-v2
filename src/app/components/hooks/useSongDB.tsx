import { SongData } from '@/../types/songData';
import { LanguageCount } from '@/../types/types';
import useSWR from 'swr'
import useSWRImmutable from 'swr/immutable'

// Add memory cache for processed song data
let processedSongDBCache: any = null;
let lastHashCache: string | null = null;

//TODO: use Zod
const fetcher = (params: [string, string]) => {
    const [url, hash] = params;
    return fetch(url).then(r => r.json());
}

const JSON2SongDB = (json: any, hash: string) => {
    if (!json) {
        return json;
    }

    // Return cached version if hash hasn't changed
    if (processedSongDBCache && lastHashCache === hash) {
        return processedSongDBCache;
    }

    const songs = json.map((d: any) => new SongData(d));

    const languages: LanguageCount = songs.map(s => s.language).reduce((acc: Record<string, number>, lang: string) => {
        acc[lang] = (acc[lang] || 0) + 1;
        return acc;
    }, {});
    const songbooks = [...new Set(songs.map(s => s.songbooks).flat())];

    const songRanges = songs.map(s => s.range?.semitones).filter(Boolean);
    const songDB = {
        maxRange: Math.max(...songRanges),
        songbooks: songbooks,
        languages,
        songs
    };

    // Cache the processed result
    processedSongDBCache = songDB;
    lastHashCache = hash;

    return songDB;
}

function useSongDB() {
    const { data: hash, error: hashError, isLoading: hashIsLoading } = useSWR(
        "/songDB.hash",
        (url: string) => fetch(url).then(r => r.text()),
        {
            keepPreviousData: true,
            // Cache hash for 5 minutes
            dedupingInterval: 5 * 60 * 1000,
            // Revalidate less frequently 
            focusThrottleInterval: 30000
        }
    );

    const { data, error, isLoading } = useSWRImmutable(
        () => hash ? ["/songDB.json", hash] : null,
        fetcher,
        {
            keepPreviousData: true,
            // Cache for much longer since it's immutable
            dedupingInterval: 24 * 60 * 60 * 1000, // 24 hours
        }
    );

    const songDB = data && hash ? JSON2SongDB(data, hash) : null;

    return {
        songDB,
        isLoading: hashIsLoading || (hash && isLoading),
        isError: hashError || error
    }
}

export default useSongDB;