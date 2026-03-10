import { Link } from "@tanstack/react-router";
import { ImagesIcon, Menu, Pencil, Shield, User } from "lucide-react";
import RandomSong from "~/components/RandomSong";
import { RichItem } from "~/components/RichDropdown";
import { DropdownThemeToggle, ThemeToggle } from "~/components/ThemeToggle";
import ToolbarBase from "~/components/ToolbarBase";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useIsOnline } from "~/hooks/use-is-online";
import type { SongDB } from "~/types/types";
import Filtering from "./filters/Filters";
import SearchBar from "./SearchBar";
import SessionView from "./SessionView";
import SortMenu from "./SortMenu";

interface CombinedMenuProps {
  isOnline: boolean;
  isAdmin: boolean;
}

const CombinedMenu = ({ isOnline, isAdmin }: CombinedMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="circular">
          <Menu />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="m-2 w-[calc(100dvw-1rem)] max-w-56 flex flex-col gap-1">
        <RichItem.Header>Menu</RichItem.Header>
        <DropdownMenuSeparator />

        <DropdownThemeToggle />

        <DropdownMenuItem asChild>
          <Link to="/edit" className="w-full cursor-pointer">
            <RichItem.Shell>
              <RichItem.Icon>
                <Pencil />
              </RichItem.Icon>
              <RichItem.Body title="Add song" />
            </RichItem.Shell>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link to="/gallery" className="w-full cursor-pointer">
            <RichItem.Shell>
              <RichItem.Icon>
                <ImagesIcon />
              </RichItem.Icon>
              <RichItem.Body title="Gallery" />
            </RichItem.Shell>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild disabled={!isOnline}>
          <Link to="/profile" className="w-full cursor-pointer">
            <RichItem.Shell>
              <RichItem.Icon>
                <User />
              </RichItem.Icon>
              <RichItem.Body title="Profile" />
            </RichItem.Shell>
          </Link>
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem asChild disabled={!isOnline}>
            <Link to="/admin" className="w-full cursor-pointer">
              <RichItem.Shell>
                <RichItem.Icon>
                  <Shield />
                </RichItem.Icon>
                <RichItem.Body title="Admin" />
              </RichItem.Shell>
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface ToolbarProps {
  songDB: SongDB;
  isVisible: boolean;
  isAdmin: boolean;
}

function Toolbar({ songDB, isVisible, isAdmin }: ToolbarProps) {
  const isOnline = useIsOnline();

  return (
    <ToolbarBase
      isVisible={isVisible}
      childContainerClassName="max-sm:justify-between"
    >
      <TooltipProvider delayDuration={300}>
        <SortMenu />
        <SearchBar />
        <Filtering songDB={songDB} />

        <SessionView isOnline={isOnline} />

        <RandomSong songs={songDB.songs} />

        <div className="hidden min-[1150px]:flex h-full w-fit">
          <ThemeToggle />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              className="hidden min-[1150px]:flex"
              size="icon"
              variant="circular"
            >
              <Link to="/edit">
                <Pencil />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Add song</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              className="hidden min-[1150px]:flex"
              size="icon"
              variant="circular"
              disabled={!isOnline}
            >
              <Link to="/profile">
                <User />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Profile</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              className="hidden min-[1150px]:flex"
              size="icon"
              variant="circular"
            >
              <Link to="/gallery">
                <ImagesIcon />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Gallery</p>
          </TooltipContent>
        </Tooltip>

        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                className="hidden min-[1150px]:flex"
                size="icon"
                variant="circular"
              >
                <Link to="/admin">
                  <Shield />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Admin</p>
            </TooltipContent>
          </Tooltip>
        )}

        <div className="flex min-[1150px]:hidden">
          <CombinedMenu isOnline={isOnline} isAdmin={isAdmin} />
        </div>
      </TooltipProvider>
    </ToolbarBase>
  );
}

export default Toolbar;
