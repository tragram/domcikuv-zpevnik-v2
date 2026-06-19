import { Link, useNavigate } from "@tanstack/react-router";
import { Dices, ListRestart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { applyFilters } from "~/features/SongList/Toolbar/filters/songFilters";
import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { UserData } from "~/hooks/use-user-data";
import { toast } from "sonner";
import { getLocalStorageItem, setLocalStorageItem } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { LanguageCount, Songbook } from "~/types/types";
import { CompactItem } from "./RichDropdown";
import { Button } from "./ui/button";
import { DropdownMenuCheckboxItem, DropdownMenuItem } from "./ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const BAN_LIST_KEY = "songsBannedFromRandom";

export const retrieveBanList = () => getLocalStorageItem(BAN_LIST_KEY, []);

export const resetBanList = () => {
  setLocalStorageItem(BAN_LIST_KEY, []);
  setLocalStorageItem("lastBanListResetDate", Date.now());
};

export function ResetBanListDropdownItems({ songs }: { songs: SongData[] }) {
  const [bannedSongs, setBannedSongs] = useLocalStorageState<string[]>(
    "songsBannedFromRandom",
    { defaultValue: [] },
  );
  const [ignoreSeenSongs, setIgnoreSeenSongs] = useLocalStorageState<boolean>(
    "ignoreSeenSongs",
    { defaultValue: true },
  );
  return (
    <>
      <DropdownMenuCheckboxItem
        onSelect={(e) => e.preventDefault()}
        checked={ignoreSeenSongs}
        onCheckedChange={() => setIgnoreSeenSongs(!ignoreSeenSongs)}
      >
        <CompactItem.Shell>
          <CompactItem.Icon>
            <Dices />
          </CompactItem.Icon>
          <CompactItem.Body
            title="Ban seen songs from random"
            subtitle="Bans reset at 3AM"
          />
        </CompactItem.Shell>
      </DropdownMenuCheckboxItem>

      <DropdownMenuItem
        onClick={() => setBannedSongs([])}
        onSelect={(e) => e.preventDefault()}
      >
        <CompactItem.Shell>
          <CompactItem.Icon>
            <ListRestart />
          </CompactItem.Icon>
          <CompactItem.Body
            title="Reset ban list"
            subtitle={`${bannedSongs.length}/${songs.length} songs marked seen`}
          />
        </CompactItem.Shell>
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
    0,
  );

  // If now is after today's 3 AM and last reset was before today's 3 AM
  return now >= resetTime && lastReset < resetTime;
}

const chooseRandomSong = (
  songs: SongData[],
  currentSong: SongData | null,
  ignoreSeenSongs: boolean,
  bannedList: string[],
) => {
  const bannedSet = ignoreSeenSongs ? new Set(bannedList) : new Set<string>();
  if (currentSong) {
    bannedSet.add(currentSong.id);
  }
  const available = songs.filter((s) => !bannedSet.has(s.id));
  if (available.length === 0) {
    return { chosenSong: null };
  }
  return { chosenSong: available[Math.floor(Math.random() * available.length)] };
};

interface RandomSongProps {
  songs: SongData[];
  // currentSong - when shown in SongView, this allows us to ban songs not entered via the shuffle button
  currentSong?: SongData | null;
  userData?: UserData;
  languageCounts?: LanguageCount;
  availableSongbooks?: Songbook[];
}

function RandomSong({
  songs,
  currentSong = null,
  userData,
  languageCounts,
  availableSongbooks = [],
}: RandomSongProps) {
  const navigate = useNavigate();
  const [isNoSongsDialogOpen, setIsNoSongsDialogOpen] = useState(false);
  const pendingNavigation = useRef(false);
  const [ignoreSeenSongs] = useLocalStorageState<boolean>("ignoreSeenSongs", {
    defaultValue: true,
  });
  const [bannedSongs, setBannedSongs] = useLocalStorageState<string[]>(
    BAN_LIST_KEY,
    { defaultValue: [] },
  );
  const {
    hideCapo,
    vocalRange,
    language,
    onlyFavorites,
    showExternal,
    selectedSongbookIds,
    resetFilters,
  } = useFilterSettingsStore();

  // Check and reset ban list on component mount
  useEffect(() => {
    const lastResetDate = getLocalStorageItem("lastBanListResetDate", null);
    if (shouldResetBanList(lastResetDate)) {
      setBannedSongs([]);
      setLocalStorageItem("lastBanListResetDate", Date.now());
    }
    // setBannedSongs is intentionally omitted — it is not stable across renders in use-local-storage-state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle current song ban
  // the component is included in SongView, so this keeps track of currently viewed songs
  useEffect(() => {
    if (!currentSong) return;
    setBannedSongs((prev) =>
      prev.includes(currentSong.id) ? prev : [...prev, currentSong.id],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong]);

  // Expensive filter pipeline — depends only on the filters, not the ban list,
  // so growing the ban list on every navigation doesn't re-run all of this.
  const pool = useMemo(
    () =>
      applyFilters(
        songs,
        {
          hideCapo,
          vocalRange,
          language,
          onlyFavorites,
          showExternal,
          selectedSongbookIds,
        },
        { userData: userData ?? null, languageCounts, availableSongbooks },
      ),
    [
      songs,
      hideCapo,
      vocalRange,
      language,
      onlyFavorites,
      showExternal,
      selectedSongbookIds,
      userData,
      languageCounts,
      availableSongbooks,
    ],
  );

  // Cheap selection — re-runs when the ban list changes (one pass over the pool).
  const { chosenSong } = useMemo(
    () => chooseRandomSong(pool, currentSong, ignoreSeenSongs, bannedSongs),
    [pool, currentSong, ignoreSeenSongs, bannedSongs],
  );
  const poolSize = pool.length;

  useEffect(() => {
    if (pendingNavigation.current && chosenSong) {
      pendingNavigation.current = false;
      navigate({ to: chosenSong.url() });
    }
  }, [chosenSong, navigate]);

  const handleClick = () => {
    if (!chosenSong) {
      setIsNoSongsDialogOpen(true);
      return;
    }
    if (poolSize < songs.length && !sessionStorage.getItem("filteredRandomToastShown")) {
      sessionStorage.setItem("filteredRandomToastShown", "1");
      toast.info(`Picking from ${poolSize} of ${songs.length} songs due to active filters.`);
    }
  };

  const hasActiveFilters = poolSize < songs.length;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="circular"
            asChild
            onClick={handleClick}
          >
            <Link to={chosenSong?.url()}>
              <Dices />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Pick random song</p>
        </TooltipContent>
      </Tooltip>

      <AlertDialog
        open={isNoSongsDialogOpen}
        onOpenChange={setIsNoSongsDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No Songs Available</AlertDialogTitle>
            <AlertDialogDescription>
              You've cycled through all available songs
              {hasActiveFilters
                ? ` (${poolSize} of ${songs.length} due to active filters)`
                : ""}
              . Would you like to reset the {hasActiveFilters ? "filters or " : ""}list and start over?
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
            {hasActiveFilters && (
              <AlertDialogAction
                onClick={() => {
                  resetFilters();
                  pendingNavigation.current = true;
                  setIsNoSongsDialogOpen(false);
                }}
              >
                Reset filters
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => {
                setBannedSongs([]);
                setLocalStorageItem("lastBanListResetDate", Date.now());
                pendingNavigation.current = true;
                setIsNoSongsDialogOpen(false);
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
