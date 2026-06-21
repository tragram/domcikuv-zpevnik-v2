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
import type { Songbook } from "~/types/types";

interface SongBookFilterProps {
  availableSongbooks: Songbook[];
  selectedSongbookId: string | null;
  toggleSongbook: (songbookId: string) => void;
  iconOnly: boolean;
  sectionOnly?: boolean;
}

const createSongbookChoices = (
  availableSongbooks: Songbook[],
  selectedSongbookId: string | null,
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
      const isSelected = selectedSongbookId === songbook.user;
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
  selectedSongbookId,
  toggleSongbook,
  iconOnly,
  sectionOnly = false,
}: SongBookFilterProps): JSX.Element => {
  const songbookChoices = createSongbookChoices(
    availableSongbooks,
    selectedSongbookId,
    toggleSongbook,
  );

  if (sectionOnly) {
    return (
      <>
        <DropdownMenuLabel className="text-sm font-semibold">
          Filter by Songbook
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">{songbookChoices}</div>
      </>
    );
  }

  const active = !!selectedSongbookId;

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
              {!iconOnly && <span>Songbook</span>}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Songbook</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-80" align="start" sideOffset={16}>
        <DropdownMenuLabel className="text-sm font-semibold">
          Filter by Songbook
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">{songbookChoices}</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
