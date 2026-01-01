import {
  Link,
  useRouteContext,
} from "@tanstack/react-router";
import { ImagesIcon, MoreHorizontal, Pencil, Shield, User } from "lucide-react";
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
  isAdmin: boolean;
}

const CombinedMenu = ({ isOnline, isAdmin }: CombinedMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="circular">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="m-2 w-[calc(100dvw-1rem)] max-w-56">
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
        {isAdmin && (
          <DropdownMenuItem asChild disabled={!isOnline}>
            <Link
              to="/admin"
              className="flex items-center gap-2 cursor-pointer"
            >
              <Shield className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          </DropdownMenuItem>
        )}
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

  const routeContext = useRouteContext({ strict: false });
  const isAdmin = routeContext?.user?.profile?.isAdmin ?? false;
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

      <SessionView isOnline={isOnline} />

      {/* Desktop View - Individual Buttons */}
      <div className="hidden min-[1150px]:flex h-full w-fit">
        <ThemeToggle />
      </div>
      <Link className="hidden min-[1150px]:flex" to="/edit">
        <Button size="icon" variant="circular">
          <Pencil />
        </Button>
      </Link>
      <Link className="hidden min-[1150px]:flex" to="/profile">
        <Button size="icon" variant="circular" disabled={!isOnline}>
          <User />
        </Button>
      </Link>
      <Link className="hidden min-[1150px]:flex" to="/gallery">
        <Button size="icon" variant="circular">
          <ImagesIcon />
        </Button>
      </Link>
      {isAdmin && (
        <Link className="hidden min-[1150px]:flex" to="/admin">
          <Button size="icon" variant="circular">
            <Shield />
          </Button>
        </Link>
      )}

      {/* Mobile/Tablet View - Combined Menu */}
      <div className="flex min-[1150px]:hidden">
        <CombinedMenu isOnline={isOnline} isAdmin={isAdmin} />
      </div>

      <RandomSong songs={songDB.songs} />
    </ToolbarBase>
  );
}

export default Toolbar;
