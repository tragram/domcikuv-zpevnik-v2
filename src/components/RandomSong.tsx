import { Dices, ListRestart } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { SongData, SongDB } from '@/types/types';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DropdownIconStart, DropdownMenuCheckboxItem, DropdownMenuItem } from './ui/dropdown-menu';
import useLocalStorageState from 'use-local-storage-state';

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

export function ResetBanListDropdownItems({ songDB }: { songDB: SongDB }) {
    const [bannedSongs, setBannedSongs] = useLocalStorageState<string[]>("songsBannedFromRandom", { defaultValue: [] });
    const [ignoreSeenSongs, setIgnoreSeenSongs] = useLocalStorageState<boolean>("ignoreSeenSongs", { defaultValue: true });
    return (
        <>
            <DropdownMenuCheckboxItem
                onSelect={(e) => e.preventDefault()}
                checked={ignoreSeenSongs}
                onCheckedChange={() => setIgnoreSeenSongs(!ignoreSeenSongs)}
            >
                <DropdownIconStart icon={<Dices />} />
                <div>
                    Ban seen songs from random
                    <p className='text-[0.7em] leading-tight'>Bans reset at 3AM</p>
                </div>
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem
                onClick={() => setBannedSongs([])}
                onSelect={(e) => e.preventDefault()}
            >
                <DropdownIconStart icon={<ListRestart />} />
                <div>
                    Reset ban list
                    <p className='text-[0.7em] leading-tight'>{bannedSongs.length}/{songDB.songs.length} songs marked seen</p>
                </div>
            </DropdownMenuItem>
        </>
    );
}

function randomSong(songs: SongData[], bannedSongs: string[]): SongData {
    if (songs.length <= bannedSongs.length) {
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
    const [ignoreSeenSongs, setIgnoreSeenSongs] = useLocalStorageState<boolean>("ignoreSeenSongs", { defaultValue: true });

    // Check and reset ban list on component mount
    useEffect(() => {
        const lastResetDate = getLocalStorageItem("lastBanListResetDate", null);
        if (shouldResetBanList(lastResetDate)) {
            resetBanList();
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
            const chosenSong = randomSong(songs, ignoreSeenSongs ? bannedSongs : []);

            // Add chosen song to banned list if not in the list (or when using banned songs, in which case this is guaranteed)
            if (ignoreSeenSongs || !bannedSongs.includes(chosenSong.id)) {
                setLocalStorageItem(BAN_LIST_KEY, [...bannedSongs, chosenSong.id]);
            }

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
                        <AlertDialogCancel onClick={() => { setIsNoSongsDialogOpen(false) }}
                        >
                            I'm good
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { resetBanList(); setIsNoSongsDialogOpen(false) }}
                        >
                            Reset bans
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default RandomSong;