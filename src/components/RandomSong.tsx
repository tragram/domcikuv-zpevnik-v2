import { Dices } from 'lucide-react';
import React, { useEffect } from 'react';
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
    }
}

// Function to check if ban list should be reset
function shouldResetBanList(lastResetDate: string | null): boolean {
    // If no last reset date, we should reset
    if (!lastResetDate) return true;
    
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    // Get today's 3 AM
    const resetTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        3, 0, 0, 0
    );
    
    // If now is after today's 3 AM and last reset was before today's 3 AM
    return now >= resetTime && lastReset < resetTime;
}

function RandomSong({ songs }) {
    const navigate = useNavigate();
    const [bannedSongs, setBannedSongs] = useLocalStorageState<string[]>("songsBannedFromRandom", { defaultValue: [] });
    const [lastResetDate, setLastResetDate] = useLocalStorageState<string>("lastBanListResetDate", { defaultValue: null });

    // Check and reset ban list on component mount
    useEffect(() => {
        if (shouldResetBanList(lastResetDate)) {
            console.log("Resetting banned songs list at", new Date().toISOString());
            setBannedSongs([]);
            setLastResetDate(new Date().toISOString());
        }
    }, [lastResetDate, setBannedSongs, setLastResetDate]);

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