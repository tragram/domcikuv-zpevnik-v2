import { Link } from "@tanstack/react-router";
import { ImagesIcon, MoreHorizontal, Pencil, User } from "lucide-react";
import RandomSong from "~/components/RandomSong";
import { DropdownThemeToggle, ThemeToggle } from "~/components/ThemeToggle";
import ToolbarBase from "~/components/ToolbarBase";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import type { SongDB } from "~/types/types";
import Filtering from "./filters/Filters";
import SearchBar from "./SearchBar";
import SessionView from "./SessionView";
import SortMenu from "./SortMenu";

interface ToolbarProps {
  showToolbar: boolean;
  scrollOffset: number;
  fakeScroll?: boolean;
  songDB: SongDB;
}

interface CombinedMenuProps {
  isOnline: boolean;
}

const CombinedMenu = ({ isOnline }: CombinedMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="circular">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="center" sideOffset={15}>
        <DropdownMenuLabel>Menu</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownThemeToggle />

        <DropdownMenuItem asChild>
          <Link to="/edit" className="flex items-center gap-2 cursor-pointer">
            <Pencil className="h-4 w-4" />
            <span>Edit</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link
            to="/gallery"
            className="flex items-center gap-2 cursor-pointer"
          >
            <ImagesIcon className="h-4 w-4" />
            <span>Gallery</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild disabled={!isOnline}>
          <Link
            to="/profile"
            className="flex items-center gap-2 cursor-pointer"
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function Toolbar({
  songDB,
  showToolbar,
  scrollOffset,
  fakeScroll = false,
}: ToolbarProps) {
  const isOnline = window.navigator.onLine;

  return (
    <ToolbarBase
      showToolbar={showToolbar}
      scrollOffset={scrollOffset}
      fakeScroll={fakeScroll}
      childContainerClassName="max-sm:justify-between"
    >
      <SortMenu />
      <SearchBar />
      <Filtering songDB={songDB} />

      <SessionView isOnline={isOnline}/>

      {/* Desktop View - Individual Buttons */}
      <div className="hidden min-[1100px]:flex h-full w-fit">
        <ThemeToggle />
      </div>
      <Link className="hidden min-[1100px]:flex" to="/edit">
        <Button size="icon" variant="circular">
          <Pencil />
        </Button>
      </Link>
      <Link className="hidden min-[1100px]:flex" to="/profile">
        <Button size="icon" variant="circular" disabled={!isOnline}>
          <User />
        </Button>
      </Link>
      <Link className="hidden min-[1100px]:flex" to="/gallery">
        <Button size="icon" variant="circular">
          <ImagesIcon />
        </Button>
      </Link>

      {/* Mobile/Tablet View - Combined Menu */}
      <div className="flex min-[1100px]:hidden">
        <CombinedMenu isOnline={isOnline} />
      </div>

      <RandomSong songs={songDB.songs} />
    </ToolbarBase>
  );
}

export default Toolbar;
