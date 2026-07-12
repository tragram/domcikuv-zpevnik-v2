import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ImagesIcon,
  ListVideo,
  Menu,
  Pencil,
  RefreshCw,
  Shield,
  User,
} from "lucide-react";
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
import { Separator } from "src/web/components/ui/separator";

interface CombinedMenuProps {
  isOnline: boolean;
  profileAvailable: boolean;
  isAdmin: boolean;
  playlistMode: boolean;
  onTogglePlaylistMode: () => void;
  onRefresh: () => void;
}

const CombinedMenu = ({
  isOnline,
  profileAvailable,
  isAdmin,
  playlistMode,
  onTogglePlaylistMode,
  onRefresh,
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

        <DropdownMenuItem
          onClick={onRefresh}
          disabled={!isOnline}
          className="w-full cursor-pointer"
        >
          <RichItem.Shell>
            <RichItem.Icon>
              <RefreshCw />
            </RichItem.Icon>
            <RichItem.Body title="Refresh songs" />
          </RichItem.Shell>
        </DropdownMenuItem>

        <DropdownThemeToggle />

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
  onRefresh: () => void;
  isSyncing: boolean;
}

function Toolbar({
  songDB,
  isVisible,
  isAdmin,
  userData,
  playlistMode,
  onTogglePlaylistMode,
  onRefresh,
  isSyncing,
}: ToolbarProps) {
  const isOnline = useIsOnline();
  // Logged-in users can open their (read-only) profile offline; logged-out users
  // only reach the login screen there, which needs the network — so offline +
  // logged-out leaves nothing to show.
  const profileAvailable = isOnline || !!userData;

  // The incremental sync often finishes faster than the eye can register, so a
  // purely isSyncing-driven spin reads as "nothing happened". Spin on click and
  // stop only at a full-rotation boundary once the sync is over.
  const [clickSpinning, setClickSpinning] = useState(false);
  const handleRefresh = () => {
    setClickSpinning(true);
    onRefresh();
  };

  return (
    <ToolbarBase
      isVisible={isVisible}
      childContainerClassName="max-sm:justify-between"
    >
      <TooltipProvider delayDuration={300}>
        <SortMenu />
        <Separator orientation="vertical" className="hidden min-[1400px]:flex h-6" />
        <SearchBar />
        <Separator orientation="vertical" className="hidden min-[1400px]:flex h-6" />
        <Filtering songDB={songDB} userData={userData} />

        <Separator
          orientation="vertical"
          className="hidden min-[1400px]:flex h-6"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="hidden min-[1400px]:flex"
              size="icon"
              variant="circular"
              onClick={handleRefresh}
              disabled={!isOnline}
              aria-label="Refresh songs"
            >
              <RefreshCw
                className={cn((clickSpinning || isSyncing) && "animate-spin")}
                onAnimationIteration={() => {
                  if (!isSyncing) setClickSpinning(false);
                }}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isOnline ? "Refresh songs" : "Offline — reconnect to refresh"}
            </p>
          </TooltipContent>
        </Tooltip>

        <div className="hidden min-[1400px]:flex h-full w-fit">
          <ThemeToggle />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className={cn(
                "hidden min-[1400px]:flex",
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

        <Separator
          orientation="vertical"
          className="hidden min-[1400px]:flex h-6"
        />
        {profileAvailable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                className="hidden min-[1400px]:flex"
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
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            {profileAvailable ? (
              <Button
                asChild
                className="hidden min-[1400px]:flex"
                size="icon"
                variant="circular"
              >
                <Link to="/profile">
                  <User />
                </Link>
              </Button>
            ) : (
              <Button
                className="hidden min-[1400px]:flex"
                size="icon"
                variant="circular"
                disabled
              >
                <User />
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {profileAvailable
                ? "Profile"
                : "Offline — log in when reconnected"}
            </p>
          </TooltipContent>
        </Tooltip>

        {isAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                className="hidden min-[1400px]:flex"
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
        <Separator
          orientation="vertical"
          className="hidden min-[1400px]:flex h-6"
        />

        <SessionView isOnline={isOnline} />

        <RandomSong
          songs={songDB.songs}
          userData={userData}
          languageCounts={songDB.languages}
          availableSongbooks={songDB.songbooks}
        />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              className="hidden min-[1400px]:flex"
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

        <div className="flex min-[1400px]:hidden">
          <CombinedMenu
            isOnline={isOnline}
            profileAvailable={profileAvailable}
            isAdmin={isAdmin}
            playlistMode={playlistMode}
            onTogglePlaylistMode={onTogglePlaylistMode}
            onRefresh={onRefresh}
          />
        </div>
      </TooltipProvider>
    </ToolbarBase>
  );
}

export default Toolbar;
