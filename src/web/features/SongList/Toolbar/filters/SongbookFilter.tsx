import { Avatar, AvatarFallback, AvatarImage } from "~/components/shadcn-ui/avatar";
import { Button } from "~/components/shadcn-ui/button";
import {
  DropdownIconStart,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/shadcn-ui/dropdown-menu";
import { BookUser } from "lucide-react";
import type { JSX } from "react";
import { Songbook } from "~/types/types";
import { getRouteApi } from "@tanstack/react-router";

interface SongBookFilterProps {
  availableSongbooks: Set<Songbook>;
  selectedSongbooks: Set<string>;
  addSongbook: (songbook: Songbook) => void;
  removeSongbook: (songbook: Songbook) => void;
  setSelectedSongbooks: (songbooks: Set<Songbook>) => void;
  clearSongbooks: () => void;
  iconOnly: boolean;
  sectionOnly: boolean; // if true, expects to be included in another dropdown menu
}

const createSongbookChoices = (
  availableSongbooks: Set<Songbook>,
  selectedSongbooks: Set<string>,
  addSongbook: (songbook: Songbook) => void,
  removeSongbook: (songbook: Songbook) => void,
  setSelectedSongbooks: (songbooks: Set<Songbook>) => void,
  clearSongbooks: () => void
): JSX.Element[] => {
  const routeApi = getRouteApi("/");
  const { songDB } = routeApi.useLoaderData();
  const toggleSongbook = (songbook: Songbook) => {
    console.log(selectedSongbooks.has(songbook.user));
    if (selectedSongbooks.has(songbook.user)) {
      removeSongbook(songbook);
    } else {
      addSongbook(songbook);
    }
  };
  let songbookChoices = Array.from(availableSongbooks)
    .map((s) => {
      return {
        user: s.user,
        label: s.name,
        image: s.image,
        count: s.songIds.length,
        onClick: () => toggleSongbook(s),
      };
    })
    .sort((a, b) => a.count - b.count);
  const allChoice = {
    label: "All",
    user: "All",
    image: "",
    count: songDB.songs.length,
    onClick: () => setSelectedSongbooks(availableSongbooks),
  };
  const noneChoice = {
    label: "None",
    user: "None",
    image: "",
    count: 0,
    onClick: clearSongbooks,
  };
  songbookChoices = [allChoice, ...songbookChoices, noneChoice];
  return songbookChoices.map((songbook) => (
    <DropdownMenuCheckboxItem
      key={songbook.user}
      onSelect={(e) => e.preventDefault()}
      checked={selectedSongbooks.has(songbook.user)}
      onClick={songbook.onClick}
    >
      <div className="flex items-center gap-2 w-full">
        <DropdownIconStart
          icon={
            <Avatar className="h-6 w-6">
              <AvatarImage src={songbook.image} />
              <AvatarFallback>
                {songbook.label.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          }
        />
        <div className="truncate justify-self-start">{songbook.label}</div>
        <div className="text-xs h-fit grow text-end">({songbook.count})</div>
      </div>
    </DropdownMenuCheckboxItem>
  ));
};

export const SongBookFilter = ({
  availableSongbooks,
  selectedSongbooks,
  addSongbook,
  removeSongbook,
  setSelectedSongbooks,
  clearSongbooks,
  iconOnly,
  sectionOnly = false,
}: SongBookFilterProps): JSX.Element => {
  console.log(selectedSongbooks, availableSongbooks);
  const active = selectedSongbooks.size < availableSongbooks.size;
  const songbookChoices = createSongbookChoices(
    availableSongbooks,
    selectedSongbooks,
    addSongbook,
    removeSongbook,
    setSelectedSongbooks,
    clearSongbooks
  );
  if (sectionOnly)
    return (
      <>
        <DropdownMenuLabel>Select songbooks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {songbookChoices}
      </>
    );
  else
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            isActive={active}
            className="outline-0 rounded-none font-bold"
          >
            <BookUser />
            {!iconOnly && "Songbooks"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent aria-label="Songbook Choices" sideOffset={15}>
          {songbookChoices}
        </DropdownMenuContent>
      </DropdownMenu>
    );
};
