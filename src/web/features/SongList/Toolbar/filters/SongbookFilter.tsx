import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { BookUser } from "lucide-react";
import type { JSX } from "react";
import { SongData } from "~/types/songData";
import { filterSongbook } from "../../useFilteredSongs";

interface Songbook {
  user: string;
  name: string;
  image: string;
  songIds: Set<string>;
}

interface SongBookFilterProps {
  availableSongbooks: Songbook[];
  selectedSongbooks: Songbook[];
  availableSongs: SongData[];
  addSongbook: (songbook: Songbook) => void;
  removeSongbook: (songbook: Songbook) => void;
  setSelectedSongbooks: (songbooks: Songbook[]) => void;
  clearSongbooks: () => void;
  iconOnly: boolean;
  sectionOnly?: boolean;
}

const createSongbookChoices = (
  availableSongbooks: Songbook[],
  selectedSongbooks: Songbook[],
  addSongbook: (songbook: Songbook) => void,
  removeSongbook: (songbook: Songbook) => void
): JSX.Element[] => {
  const toggleSongbook = (songbook: Songbook) => {
    const isSelected = selectedSongbooks.some((s) => s.user === songbook.user);
    if (isSelected) {
      removeSongbook(songbook);
    } else {
      addSongbook(songbook);
    }
  };

  return availableSongbooks
    .filter((as) => as.songIds.size > 0)
    .map((songbook) => ({
      songbook,
      label: songbook.name,
      image: songbook.image,
      count: songbook.songIds.size,
      onClick: () => toggleSongbook(songbook),
    }))
    .sort((a, b) => b.count - a.count)
    .map(({ songbook, label, image, count, onClick }) => {
      const isSelected = selectedSongbooks.some(
        (s) => s.user === songbook.user
      );
      return (
        <DropdownMenuCheckboxItem
          key={songbook.user}
          onSelect={(e) => e.preventDefault()}
          checked={isSelected}
          onClick={onClick}
          className="py-2"
        >
          <div className="flex items-center gap-3 w-full min-w-0">
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarImage src={image} />
              <AvatarFallback className="text-xs">
                {label.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="truncate flex-1 text-sm">{label}</div>
            <div className="text-xs text-primary/80 flex-shrink-0">
              {count} songs
            </div>
          </div>
        </DropdownMenuCheckboxItem>
      );
    });
};

export const SongBookFilter = ({
  availableSongbooks,
  selectedSongbooks,
  availableSongs,
  addSongbook,
  removeSongbook,
  setSelectedSongbooks,
  clearSongbooks,
  iconOnly,
  sectionOnly = false,
}: SongBookFilterProps): JSX.Element => {
  const totalSongsInSongbooks = availableSongbooks.reduce(
    (sum, songbook) => sum + songbook.songIds.size,
    0
  );

  const allSelected = availableSongbooks.every((songbook) =>
    selectedSongbooks.some((selected) => selected.user === songbook.user)
  );

  const handleSelectAll = () => {
    if (allSelected) {
      clearSongbooks();
    } else {
      setSelectedSongbooks(availableSongbooks);
    }
  };

  const songbookChoices = createSongbookChoices(
    availableSongbooks,
    selectedSongbooks,
    addSongbook,
    removeSongbook
  );

  const SelectAllButton = () => (
    <DropdownMenuCheckboxItem
      onSelect={(e) => e.preventDefault()}
      checked={false}
      onClick={handleSelectAll}
      className="py-2"
    >
      <div className="flex items-center gap-3 w-full min-w-0">
        <div className="flex items-center justify-center h-7 w-7 bg-primary/10 rounded-full flex-shrink-0">
          <BookUser className="h-4 w-4 text-primary" />
        </div>
        <div className="truncate flex-1 text-sm">
          {allSelected ? "All songs" : "Select all"}
        </div>
        <div className="text-xs flex-shrink-0 text-primary/80 ">
          {allSelected
            ? `${availableSongs.length} songs`
            : `${totalSongsInSongbooks} songs`}
        </div>
      </div>
    </DropdownMenuCheckboxItem>
  );

  const selectedInfo = (
    availableSongbooks: Songbook[],
    selectedSongbooks: Songbook[],
    availableSongs: SongData[]
  ) => {
    const selectedSongs = filterSongbook(
      availableSongs,
      selectedSongbooks,
      availableSongbooks
    );
    return selectedSongbooks.length > 0 ? (
      <>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-xs text-primary/80 text-right">
          {` ${selectedSongbooks.length}/${availableSongbooks.length} songbooks
         • ${selectedSongs.length}/${availableSongs.length} songs`}
        </div>
      </>
    ) : (
      <></>
    );
  };

  if (sectionOnly) {
    return (
      <>
        <DropdownMenuLabel className="text-sm font-semibold">
          Filter by Songbooks
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <SelectAllButton />
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">{songbookChoices}</div>
        {selectedInfo(availableSongbooks, selectedSongbooks, availableSongs)}
      </>
    );
  }

  const active = selectedSongbooks.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="circular"
          isActive={active}
          className="outline-0 rounded-none font-bold"
        >
          <BookUser className="h-4 w-4" />
          {!iconOnly && (
            <span>
              Songbooks
              {selectedSongbooks.length > 0 &&
                selectedSongbooks.length < availableSongbooks.length && (
                  <span className="ml-1 text-xs opacity-75">
                    ({selectedSongbooks.length})
                  </span>
                )}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start" sideOffset={8}>
        <DropdownMenuLabel className="text-sm font-semibold">
          Filter by Songbooks
        </DropdownMenuLabel>
        <SelectAllButton />
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">{songbookChoices}</div>
        {selectedInfo(availableSongbooks, selectedSongbooks, availableSongs)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
