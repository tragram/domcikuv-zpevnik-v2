import { SongData } from 'src/types/songData';
import { LanguageCount } from 'src/types/types';
import useSWR from 'swr'

//TODO: use Zod

const JSON2SongDB = (json) => {
    const songs = json.map(d => new SongData(d));

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
    return songDB;
}

function useSongDB() {
    const { data, error, isLoading } = useSWR("/songDB.json", fetch, { keepPreviousData: true });

    return {
        songDB: JSON2SongDB(data),
        isLoading,
        isError: error
    }
}

export default useSongDB;