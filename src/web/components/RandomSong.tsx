import { Link } from "@tanstack/react-router";
import { Dices, ListRestart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useLocalStorageState from "use-local-storage-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { SongData } from "~/types/songData";
import type { SongDB } from "~/types/types";
import { Button } from "./ui/button";
import {
  DropdownIconStart,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { getLocalStorageItem, setLocalStorageItem } from "~/lib/utils";

const BAN_LIST_KEY = "songsBannedFromRandom";

export const retrieveBanList = () => getLocalStorageItem(BAN_LIST_KEY, []);

export const resetBanList = () => {
  setLocalStorageItem(BAN_LIST_KEY, []);
  setLocalStorageItem("lastBanListResetDate", new Date().toISOString());
};

export function ResetBanListDropdownItems({ songDB }: { songDB: SongDB }) {
  const [bannedSongs, setBannedSongs] = useLocalStorageState<string[]>(
    "songsBannedFromRandom",
    { defaultValue: [] }
  );
  const [ignoreSeenSongs, setIgnoreSeenSongs] = useLocalStorageState<boolean>(
    "ignoreSeenSongs",
    { defaultValue: true }
  );
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
          <p className="text-[0.7em] leading-tight">Bans reset at 3AM</p>
        </div>
      </DropdownMenuCheckboxItem>
      <DropdownMenuItem
        onClick={() => setBannedSongs([])}
        onSelect={(e) => e.preventDefault()}
      >
        <DropdownIconStart icon={<ListRestart />} />
        <div>
          Reset ban list
          <p className="text-[0.7em] leading-tight">
            {bannedSongs.length}/{songDB.songs.length} songs marked seen
          </p>
        </div>
      </DropdownMenuItem>
    </>
  );
}

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
    3,
    0,
    0,
    0
  );

  // If now is after today's 3 AM and last reset was before today's 3 AM
  return now >= resetTime && lastReset < resetTime;
}

const banSongFactory = (
  ignoreSeenSongs: boolean,
  bannedSongs: string[],
  songToBan: string
) => {
  if (ignoreSeenSongs || !bannedSongs.includes(songToBan)) {
    // Add chosen song to banned list if not in the list (or when using banned songs, in which case it is guaranteed that it is not in the list)
    setLocalStorageItem(BAN_LIST_KEY, [...bannedSongs, songToBan]);
  }
};

const chooseRandomSong = (
  songs: SongData[],
  currentSong: SongData | null,
  ignoreSeenSongs: boolean
) => {
  const bannedSongs = ignoreSeenSongs ? new Set(retrieveBanList()) : new Set();
  if (currentSong) {
    bannedSongs.add(currentSong.id);
  }
  if (songs.length <= bannedSongs.size) {
    return { chosenSong: null, banSong: () => {} };
  }
  let chosenSong;
  while (true) {
    chosenSong = songs[Math.floor(Math.random() * songs.length)];
    if (!bannedSongs.has(chosenSong.id)) {
      break;
    }
  }
  return {
    chosenSong,
    banSong: () =>
      banSongFactory(
        ignoreSeenSongs,
        Array.from(bannedSongs) as string[],
        chosenSong.id
      ),
  };
};

interface RandomSongProps {
  songs: SongData[];
  // currentSong - when shown in SongView, this allows us to ban songs not entered via the shuffle button
  currentSong?: SongData | null;
}

function RandomSong({ songs, currentSong = null }: RandomSongProps) {
  const [isNoSongsDialogOpen, setIsNoSongsDialogOpen] = useState(false);
  const [ignoreSeenSongs] = useLocalStorageState<boolean>("ignoreSeenSongs", {
    defaultValue: true,
  });

  // used to force reload of the component and find a song after banlist reset
  const [reloads, setReloads] = useState(0);

  // Check and reset ban list on component mount
  useEffect(() => {
    const lastResetDate = getLocalStorageItem("lastBanListResetDate", null);
    if (shouldResetBanList(lastResetDate)) {
      resetBanList();
    }
  }, []);

  // Handle current song ban
  // the component is included in SongView, so this keeps track of currently viewed songs
  // TODO: would probably be cleaner to implement this explicitly as a separate hook
  useEffect(() => {
    if (!currentSong) return;
    const bannedSongs = retrieveBanList();

    // Skip if song is already in banned list
    if (bannedSongs.includes(currentSong.id)) return;

    // Add current song to banned songs
    setLocalStorageItem(BAN_LIST_KEY, [...bannedSongs, currentSong.id]);
  }, [reloads, currentSong]);

  const { chosenSong, banSong } = useMemo(() => {
    return chooseRandomSong(songs, currentSong, ignoreSeenSongs);
  }, [reloads, currentSong]);

  return (
    <>
      <Button
        size="icon"
        variant="circular"
        onClick={chosenSong ? banSong : () => setIsNoSongsDialogOpen(true)}
      >
        <Link to={chosenSong?.url()}>
          <Dices />
        </Link>
      </Button>

      <AlertDialog
        open={isNoSongsDialogOpen}
        onOpenChange={setIsNoSongsDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Songs Available</AlertDialogTitle>
            <AlertDialogDescription>
              You've cycled through all available songs. Would you like to reset
              the list and start over?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsNoSongsDialogOpen(false);
              }}
            >
              I'm good
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetBanList();
                setIsNoSongsDialogOpen(false);
                setReloads(reloads + 1);
              }}
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
