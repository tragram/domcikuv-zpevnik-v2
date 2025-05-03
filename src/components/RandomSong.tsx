import { Dices } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { SongData } from '@/types/types';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BAN_LIST_KEY = "songsBannedFromRandom";

// LocalStorage Helper Functions
const getLocalStorageItem = (key, defaultValue) => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
};

const setLocalStorageItem = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};

export const retrieveBanList = () => getLocalStorageItem(BAN_LIST_KEY, []);

export const resetBanList = () => {
    setLocalStorageItem(BAN_LIST_KEY, []);
    setLocalStorageItem("lastBanListResetDate", new Date().toISOString());
};

function randomSong(songs: SongData[], bannedSongs: string[]): SongData {
    console.log(bannedSongs);
    if (songs.length === bannedSongs.length) {
        throw Error("No more random songs available!");
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

interface RandomSongProps {
    songs: SongData[];
    // currentSong - when shown in SongView, this allows us to ban songs not entered via the shuffle button
    currentSong?: SongData | null;
}

function RandomSong({ songs, currentSong = null }: RandomSongProps) {
    const navigate = useNavigate();
    const [isNoSongsDialogOpen, setIsNoSongsDialogOpen] = useState(false);

    // Check and reset ban list on component mount
    useEffect(() => {
        const lastResetDate = getLocalStorageItem("lastBanListResetDate", null);
        if (shouldResetBanList(lastResetDate)) {
            console.log("Resetting banned songs list at", new Date().toISOString());
            setLocalStorageItem(BAN_LIST_KEY, []);
            setLocalStorageItem("lastBanListResetDate", new Date().toISOString());
        }
    }, []);

    // Handle current song ban
    useEffect(() => {
        if (!currentSong) return;
        const bannedSongs = retrieveBanList();

        // Skip if song is already in banned list
        if (bannedSongs.includes(currentSong.id)) return;

        // Add current song to banned songs
        setLocalStorageItem(BAN_LIST_KEY, [...bannedSongs, currentSong.id]);
    }, [currentSong]);

    const selectSong = () => {
        try {
            const bannedSongs = retrieveBanList();
            const chosenSong = randomSong(songs, bannedSongs);

            // Add chosen song to banned list
            setLocalStorageItem(BAN_LIST_KEY, [...bannedSongs, chosenSong.id]);

            return chosenSong;
        } catch (error) {
            // Show the dialog when no songs are available
            setIsNoSongsDialogOpen(true);
            return null;
        }
    };

    const handleButtonClick = () => {
        const song = selectSong();
        if (song) {
            navigate(song.url());
        }
    };

    return (
        <>
            <Button size="icon" variant="circular" onClick={handleButtonClick}>
                <Dices />
            </Button>

            <AlertDialog open={isNoSongsDialogOpen} onOpenChange={setIsNoSongsDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>No Songs Available</AlertDialogTitle>
                        <AlertDialogDescription>
                            You've cycled through all available songs. Would you like to reset the list and start over?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => { resetBanList(); setIsNoSongsDialogOpen(false) }}>
                            Reset bans
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default RandomSong;