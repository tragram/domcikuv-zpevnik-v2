import { Dices } from 'lucide-react';
import React from 'react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import useLocalStorageState from 'use-local-storage-state';
import { SongData } from '@/types/types';

function randomSong(songs: SongData[], bannedSongs: string[]): SongData {
    console.log(bannedSongs)
    if (songs.length === bannedSongs.length) {
        throw Error("No more random songs available!")
    }
    while (true) {
        const selectedSong = songs[Math.floor(Math.random() * songs.length)];
        if (!bannedSongs.includes(selectedSong.id)) {
            return selectedSong;
        }
        console.log("tried to open",selectedSong.id,"but did not!")
    }
}
function RandomSong({ songs }) {
    const navigate = useNavigate();
    const [bannedSongs, setBannedSongs] = useLocalStorageState<string[]>("songsBannedFromRandom", { defaultValue: [] });
    const selectSong = () => {
        const chosenSong = randomSong(songs, bannedSongs);
        setBannedSongs([...bannedSongs, chosenSong.id]);
        return chosenSong;
    }
    return (
        <Button size="icon" variant="circular" onClick={() => navigate(selectSong().url())}>
            <Dices />
        </Button>
    )
}

export default RandomSong;