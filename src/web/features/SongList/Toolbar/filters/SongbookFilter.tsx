import { BookUser } from "lucide-react";
import type { JSX } from "react";
import { RichItem } from "~/components/RichDropdown";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { SongData } from "~/types/songData";
import type { Songbook } from "~/types/types";
import { filterSongbook } from "./songFilters";

interface SongBookFilterProps {
  availableSongbooks: Songbook[];
  selectedSongbookIds: string[];
  availableSongs: SongData[];
  toggleSongbook: (songbookId: string) => void;
  setSelectedSongbookIds: (ids: string[]) => void;
  clearSongbooks: () => void;
  iconOnly: boolean;
  sectionOnly?: boolean;
}

const createSongbookChoices = (
  availableSongbooks: Songbook[],
  selectedSongbookIds: string[],
  toggleSongbook: (songbookId: string) => void,
): JSX.Element[] => {
  return availableSongbooks
    .filter((as) => as.songIds.size > 0)
    .map((songbook) => ({
      songbook,
      label: songbook.name,
      image: songbook.image,
      count: songbook.songIds.size,
    }))
    .sort((a, b) => b.count - a.count)
    .map(({ songbook, label, image, count }) => {
      const isSelected = selectedSongbookIds.includes(songbook.user);
      return (
        <DropdownMenuCheckboxItem
          key={songbook.user}
          onSelect={(e) => e.preventDefault()}
          checked={isSelected}
          onClick={() => toggleSongbook(songbook.user)}
          className="py-2"
        >
          <RichItem.Shell>
            <RichItem.Avatar src={image} fallback={label} />
            <RichItem.Body title={label} />
            <RichItem.Trailing>{count} songs</RichItem.Trailing>
          </RichItem.Shell>
        </DropdownMenuCheckboxItem>
      );
    });
};

export const SongBookFilter = ({
  availableSongbooks,
  selectedSongbookIds,
  availableSongs,
  toggleSongbook,
  setSelectedSongbookIds,
  clearSongbooks,
  iconOnly,
  sectionOnly = false,
}: SongBookFilterProps): JSX.Element => {
  const totalSongsInSongbooks = availableSongbooks.reduce(
    (sum, songbook) => sum + songbook.songIds.size,
    0,
  );

  const allSelected =
    availableSongbooks.length > 0 &&
    availableSongbooks.every((songbook) =>
      selectedSongbookIds.includes(songbook.user),
    );

  const handleSelectAll = () => {
    if (allSelected) {
      clearSongbooks();
    } else {
      setSelectedSongbookIds(availableSongbooks.map((s) => s.user));
    }
  };

  const songbookChoices = createSongbookChoices(
    availableSongbooks,
    selectedSongbookIds,
    toggleSongbook,
  );

  const selectAllButton = (
    <DropdownMenuCheckboxItem
      onSelect={(e) => e.preventDefault()}
      checked={false}
      onClick={handleSelectAll}
      className="py-2"
    >
      <RichItem.Shell>
        <RichItem.Icon>
          <BookUser className="h-4 w-4" />
        </RichItem.Icon>
        <RichItem.Body title={allSelected ? "All songs" : "Select all"} />
        <RichItem.Trailing>
          {allSelected ? availableSongs.length : totalSongsInSongbooks} songs
        </RichItem.Trailing>
      </RichItem.Shell>
    </DropdownMenuCheckboxItem>
  );

  const selectedInfo = () => {
    const selectedSongs = filterSongbook(
      availableSongs,
      availableSongbooks,
      selectedSongbookIds,
    );
    return selectedSongbookIds.length > 0 ? (
      <>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-xs text-primary/80 text-right">
          {` ${selectedSongbookIds.length}/${availableSongbooks.length} songbooks
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
        {selectAllButton}
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">{songbookChoices}</div>
        {selectedInfo()}
      </>
    );
  }

  const active = selectedSongbookIds.length > 0;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
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
                  {selectedSongbookIds.length > 0 &&
                    selectedSongbookIds.length < availableSongbooks.length && (
                      <span className="ml-1 text-xs opacity-75">
                        ({selectedSongbookIds.length})
                      </span>
                    )}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Songbooks</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-80" align="start" sideOffset={16}>
        <DropdownMenuLabel className="text-sm font-semibold">
          Filter by Songbooks
        </DropdownMenuLabel>
        {selectAllButton}
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">{songbookChoices}</div>
        {selectedInfo()}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
