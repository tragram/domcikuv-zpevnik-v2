import RandomSong, { ResetBanListDropdownItems } from "~/components/RandomSong";
import { Button } from "~/components/ui/button";
import {
  DropdownIconStart,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import usePWAInstall from "~/components/usePWAInstall";
import { Key } from "~/types/musicTypes";
import {
  Coffee,
  Fullscreen,
  Github,
  Pencil,
  Settings2,
  Undo2,
  CloudSync,
} from "lucide-react";
import React, { useEffect } from "react";
import type { FullScreenHandle } from "react-full-screen";
import { useScrollHandler } from "../hooks/useScrollHandler";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import {
  ChordSettingsButtons,
  ChordSettingsDropdownMenu,
} from "./ChordSettingsMenu";
import {
  LayoutSettingsDropdownSection,
  LayoutSettingsToolbar,
} from "./LayoutSettings";
import TransposeSettings from "./TransposeSettings";
import ToolbarBase from "~/components/ToolbarBase";
import { Link } from "@tanstack/react-router";
import { DropdownThemeToggle } from "~/components/ThemeToggle";
import { SongDB } from "~/types/types";
import { SongData } from "~/types/songData";
import { useWakeLock } from "react-screen-wake-lock";
import useLocalStorageState from "use-local-storage-state";
import { UserProfileData } from "src/worker/api/userProfile";

interface ToolbarProps {
  songDB: SongDB;
  songData: SongData;
  user: UserProfileData;
  fullScreenHandle: FullScreenHandle;
  originalKey: Key | undefined;
  transposeSteps: number;
  setTransposeSteps: (value: number) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  songDB,
  songData,
  user,
  fullScreenHandle,
  originalKey,
  transposeSteps,
  setTransposeSteps,
}) => {
  const { layout, shareSession , actions} = useViewSettingsStore();
  const setShareSession = actions.setShareSession;
  const { isToolbarVisible } = useScrollHandler(layout.fitScreenMode);

  const { PWAInstallComponent, installItem } = usePWAInstall();
  const {
    request: wakeLockRequest,
    release: wakeLockRelease,
    isSupported: wakeLockSupported,
  } = useWakeLock({
    reacquireOnPageVisible: true,
  });
  const [wakeLockEnabled, setWakeLockEnabled] = useLocalStorageState<boolean>(
    "wakeLockEnabled",
    { defaultValue: true }
  );
  useEffect(() => {
    if (wakeLockSupported && wakeLockEnabled) {
      wakeLockRequest();
    } else {
      wakeLockRelease();
    }
  }, [wakeLockSupported, wakeLockEnabled, wakeLockRequest, wakeLockRelease]);

  useEffect(() => {
    if (!user.loggedIn) {
      setShareSession(false);
    }
  },[setShareSession, user.loggedIn])

  return (
    <div className="absolute top-0 w-full">
      <ToolbarBase showToolbar={isToolbarVisible} scrollOffset={window.scrollY}>
        <Button size="icon" variant="circular" asChild>
          <Link to="/">
            <Undo2 />
          </Link>
        </Button>

        <ChordSettingsButtons />
        <LayoutSettingsToolbar fullScreenHandle={fullScreenHandle} />
        <TransposeSettings
          originalKey={originalKey}
          transposeSteps={transposeSteps}
          setTransposeSteps={setTransposeSteps}
        />

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular">
              <Settings2 size={32} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-[85dvh] overflow-y-auto">
            {React.Children.toArray(<LayoutSettingsDropdownSection />)}
            {React.Children.toArray(<ChordSettingsDropdownMenu />)}
            <DropdownMenuLabel>Misc</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownThemeToggle />
            <DropdownMenuItem
              onClick={() => {
                fullScreenHandle.enter();
              }}
            >
              <DropdownIconStart icon={<Fullscreen />} />
              Enter fullscreen
            </DropdownMenuItem>
            {React.Children.toArray(
              <ResetBanListDropdownItems songDB={songDB} />
            )}
            {wakeLockSupported && (
              <DropdownMenuCheckboxItem
                onSelect={(e) => e.preventDefault()}
                checked={wakeLockEnabled}
                onCheckedChange={() => setWakeLockEnabled(!wakeLockEnabled)}
              >
                <DropdownIconStart icon={<Coffee />} />
                Keep screen on
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuCheckboxItem
              onSelect={(e) => e.preventDefault()}
              disabled={!user.loggedIn || !user.profile.nickname}
              checked={shareSession}
              onCheckedChange={() => setShareSession(!shareSession)}

            >
              <DropdownIconStart icon={<CloudSync />} />

              <div>
                Share current song
                {!user.loggedIn || !user.profile.nickname &&
                  (
                    <p className="text-[0.7em] leading-tight">
                      You need to be logged in and have a nickname to use this.
                    </p>
                  )}
                  {shareSession && user.loggedIn && user.profile.nickname &&
                  (
                    <p className="text-[0.7em] leading-tight">
                      Your session can be viewed at {window.location.host}/feed/{user.profile.nickname}
                    </p>
                  ) }
              </div>
            </DropdownMenuCheckboxItem>
            <DropdownMenuItem>
              <DropdownIconStart icon={<Pencil />} />
              <Link className="w-full h-full" to={"/edit/" + songData.id}>
                View in Editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <DropdownIconStart icon={<Github />} />
              <Link
                className="w-full h-full"
                to={
                  "https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" +
                  songData.id +
                  ".pro"
                }
              >
                Edit on GitHub
              </Link>
            </DropdownMenuItem>
            {installItem}
          </DropdownMenuContent>
        </DropdownMenu>
        <RandomSong songs={songDB.songs} currentSong={songData} />
      </ToolbarBase>
      {PWAInstallComponent}
    </div>
  );
};
