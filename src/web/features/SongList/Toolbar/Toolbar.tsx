import { Link } from "@tanstack/react-router";
import { ImagesIcon, ListVideo, Menu, Pencil, Shield, User } from "lucide-react";
import RandomSong from "~/components/RandomSong";
import { UserData } from "~/hooks/use-user-data";
import { cn } from "~/lib/utils";
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
  profileAvailable: boolean;
  isAdmin: boolean;
  playlistMode: boolean;
  onTogglePlaylistMode: () => void;
}

const CombinedMenu = ({
  isOnline,
  profileAvailable,
  isAdmin,
  playlistMode,
  onTogglePlaylistMode,
}: CombinedMenuProps) => {
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

        <DropdownMenuItem
          onClick={onTogglePlaylistMode}
          className="w-full cursor-pointer"
        >
          <RichItem.Shell>
            <RichItem.Icon>
              <ListVideo />
            </RichItem.Icon>
            <RichItem.Body
              title={playlistMode ? "Exit playlist" : "YouTube playlist"}
            />
          </RichItem.Shell>
        </DropdownMenuItem>

        <DropdownMenuItem asChild disabled={!profileAvailable}>
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
  userData: UserData;
  playlistMode: boolean;
  onTogglePlaylistMode: () => void;
}

function Toolbar({
  songDB,
  isVisible,
  isAdmin,
  userData,
  playlistMode,
  onTogglePlaylistMode,
}: ToolbarProps) {
  const isOnline = useIsOnline();
  // Logged-in users can open their (read-only) profile offline; logged-out users
  // only reach the login screen there, which needs the network — so offline +
  // logged-out leaves nothing to show.
  const profileAvailable = isOnline || !!userData;

  return (
    <ToolbarBase
      isVisible={isVisible}
      childContainerClassName="max-sm:justify-between"
    >
      <TooltipProvider delayDuration={300}>
        <SortMenu />
        <SearchBar />
        <Filtering songDB={songDB} userData={userData} />

        <SessionView isOnline={isOnline} />

        <RandomSong
          songs={songDB.songs}
          userData={userData}
          languageCounts={songDB.languages}
          availableSongbooks={songDB.songbooks}
        />

        <div className="hidden min-[1150px]:flex h-full w-fit">
          <ThemeToggle />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn(
                "hidden min-[1150px]:flex",
                playlistMode && "ring-2 ring-primary text-primary",
              )}
              size="icon"
              variant="circular"
              onClick={onTogglePlaylistMode}
              aria-pressed={playlistMode}
            >
              <ListVideo />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{playlistMode ? "Exit playlist" : "Make YouTube playlist"}</p>
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
            {profileAvailable ? (
              <Button
                asChild
                className="hidden min-[1150px]:flex"
                size="icon"
                variant="circular"
              >
                <Link to="/profile">
                  <User />
                </Link>
              </Button>
            ) : (
              <Button
                className="hidden min-[1150px]:flex"
                size="icon"
                variant="circular"
                disabled
              >
                <User />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>{profileAvailable ? "Profile" : "Offline — log in when reconnected"}</p>
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
          <CombinedMenu
            isOnline={isOnline}
            profileAvailable={profileAvailable}
            isAdmin={isAdmin}
            playlistMode={playlistMode}
            onTogglePlaylistMode={onTogglePlaylistMode}
          />
        </div>
      </TooltipProvider>
    </ToolbarBase>
  );
}

export default Toolbar;
