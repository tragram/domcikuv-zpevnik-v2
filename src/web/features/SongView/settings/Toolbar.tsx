import RandomSong, { ResetBanListDropdownItems } from "~/components/RandomSong";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
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
  RefreshCw,
  Contrast,
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
import { CompactItem } from "~/components/RichDropdown";

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
  const { layout, actions } = useViewSettingsStore();
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

  const handleForceUpdate = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.update();
        }
        window.location.reload();
      });
    } else {
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

            <CompactItem.Header>Misc</CompactItem.Header>
            <DropdownMenuSeparator />
            <DropdownThemeToggle size={6} />

            <DropdownMenuCheckboxItem
              onSelect={(e) => e.preventDefault()}
              checked={layout.highContrast}
              onCheckedChange={() =>
                actions.setLayoutSettings({
                  highContrast: !layout.highContrast,
                })
              }
            >
              <CompactItem.Shell>
                <CompactItem.Icon>
                  <Contrast />
                </CompactItem.Icon>
                <CompactItem.Body title="High contrast" />
              </CompactItem.Shell>
            </DropdownMenuCheckboxItem>

            <DropdownMenuItem
              onClick={() => {
                fullScreenHandle.enter();
              }}
            >
              <CompactItem.Shell>
                <CompactItem.Icon>
                  <Fullscreen />
                </CompactItem.Icon>
                <CompactItem.Body title="Enter fullscreen" />
              </CompactItem.Shell>
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
                <CompactItem.Shell>
                  <CompactItem.Icon>
                    <Coffee />
                  </CompactItem.Icon>
                  <CompactItem.Body title="Keep screen on" />
                </CompactItem.Shell>
              </DropdownMenuCheckboxItem>
            )}

            <ShareSongButton
              feedStatus={feedStatus}
              user={user}
              songId={songData.id}
            />

            <DropdownMenuItem>
              <Link
                className="w-full"
                to="/edit/$songId"
                params={{ songId: songData.id }}
                search={{ version: versionId }}
              >
                <CompactItem.Shell className="cursor-pointer w-full">
                  <CompactItem.Icon>
                    <Pencil />
                  </CompactItem.Icon>
                  <CompactItem.Body title="View in Editor" />
                </CompactItem.Shell>
              </Link>
            </DropdownMenuItem>

            {installItem}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleForceUpdate}
              disabled={!("serviceWorker" in navigator)}
            >
              <CompactItem.Shell>
                <CompactItem.Icon>
                  <RefreshCw />
                </CompactItem.Icon>
                <CompactItem.Body
                  title={`Currently on v${__APP_VERSION__}`}
                  subtitle="Click to force update"
                />
              </CompactItem.Shell>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarBase>
      {PWAInstallComponent}
    </div>
  );
};
