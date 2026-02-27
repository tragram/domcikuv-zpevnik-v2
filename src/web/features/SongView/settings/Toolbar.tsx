import RandomSong, { ResetBanListDropdownItems } from "~/components/RandomSong";
import { Button } from "~/components/ui/button";
import {
  DropdownIconStart,
  DropdownItemWithDescription,
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
  CloudOff,
  RefreshCw, // <-- Added for the update button
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
import { Link, useSearch } from "@tanstack/react-router";
import { DropdownThemeToggle } from "~/components/ThemeToggle";
import { SongDB } from "~/types/types";
import { SongData } from "~/types/songData";
import { useWakeLock } from "react-screen-wake-lock";
import useLocalStorageState from "use-local-storage-state";
import { UserProfileData } from "src/worker/api/userProfile";
import { FeedStatus } from "../SongView";
import ShareSongButton from "../components/ShareSongButton";
import { AvatarWithFallback } from "~/components/ui/avatar";
import { version as appVersion } from "../../../../../package.json";

interface ToolbarProps {
  songDB: SongDB;
  songData: SongData;
  user: UserProfileData;
  feedStatus: FeedStatus | undefined;
  fullScreenHandle: FullScreenHandle;
  originalKey: Key | undefined;
  transposeSteps: number;
  setTransposeSteps: (value: number) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  songDB,
  songData,
  user,
  feedStatus,
  fullScreenHandle,
  originalKey,
  transposeSteps,
  setTransposeSteps,
}) => {
  const { layout } = useViewSettingsStore();
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
    { defaultValue: true },
  );
  useEffect(() => {
    if (wakeLockSupported && wakeLockEnabled) {
      wakeLockRequest();
    } else {
      wakeLockRelease();
    }
  }, [wakeLockSupported, wakeLockEnabled, wakeLockRequest, wakeLockRelease]);

  const { version: versionId } = useSearch({ strict: false });

  // Handler to force SW update and reload
  const handleForceUpdate = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.update();
        }
        // Reload to apply the new service worker rules immediately
        window.location.reload();
      });
    } else {
      // Fallback reload if SW isn't supported
      window.location.reload();
    }
  };

  return (
    <div className="absolute top-0 w-full">
      <ToolbarBase isVisible={isToolbarVisible}>
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

        {feedStatus?.isMaster ? (
          <RandomSong songs={songDB.songs} currentSong={songData} />
        ) : (
          <Button
            size="icon"
            variant="circular"
            disabled
            className="!opacity-100"
          >
            {feedStatus?.isConnected ? (
              <AvatarWithFallback
                avatarSrc={feedStatus.sessionState?.masterAvatar ?? undefined}
                fallbackStr={feedStatus.sessionState?.masterNickname ?? "?"}
                avatarClassName="h-full w-full"
              />
            ) : (
              <CloudOff />
            )}
          </Button>
        )}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular">
              <Settings2 size={32} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="m-2 w-[calc(100dvw-1rem)] max-w-80 max-h-[85dvh] overflow-y-auto">
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
              <ResetBanListDropdownItems songDB={songDB} />,
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
            <ShareSongButton feedStatus={feedStatus} user={user} />
            <DropdownMenuItem>
              <Link
                className="flex items-center gap-2 cursor-pointer w-full"
                to="/edit/$songId"
                params={{ songId: songData.id }}
                search={{ version: versionId }}
              >
                <DropdownIconStart icon={<Pencil />} />
                View in Editor
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link
                className="flex items-center gap-2 cursor-pointer w-full"
                to={
                  "https://github.com/tragram/domcikuv-zpevnik-v2/tree/main/songs/chordpro/" +
                  songData.id +
                  ".pro"
                }
              >
                <DropdownIconStart icon={<Github />} />
                Edit on GitHub
              </Link>
            </DropdownMenuItem>
            {installItem}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleForceUpdate}
              disabled={!("serviceWorker" in navigator)}
            >
              <DropdownIconStart icon={<RefreshCw />} />
              <DropdownItemWithDescription
                title={`Currently on v${appVersion}`}
                description={"Click to force update"}
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarBase>
      {PWAInstallComponent}
    </div>
  );
};
