import { Coffee, Contrast, RefreshCw, Settings2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useWakeLock } from "react-screen-wake-lock";
import useLocalStorageState from "use-local-storage-state";
import {
  songPanelClassName,
  toolbarPanelPlacement,
} from "~/features/SongView/components/songPanel";
import { useViewSettingsStore } from "~/features/SongView/hooks/viewSettingsStore";
import { ChordSettingsDropdownMenu } from "~/features/SongView/settings/ChordSettingsMenu";
import { LayoutSettingsDropdownSection } from "~/features/SongView/settings/LayoutSettings";
import { useIsOnline } from "~/hooks/use-is-online";
import { runUpdateAction, updateLabels, useAppUpdate } from "~/services/app-updates";
import type { SongData } from "~/types/songData";
import { ResetBanListDropdownItems } from "./RandomSong";
import { CompactItem } from "./RichDropdown";
import { DropdownThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import usePWAInstall from "./usePWAInstall";

interface ToolbarSettingsProps {
  songs: SongData[];
  compactMenuItems?: ReactNode;
  keepSongScreenAwake?: boolean;
  appSettingsLast?: boolean;
  children?: ReactNode;
}

export function ToolbarSettings({
  songs,
  compactMenuItems,
  keepSongScreenAwake = false,
  appSettingsLast = false,
  children,
}: ToolbarSettingsProps) {
  const highContrast = useViewSettingsStore((state) => state.layout.highContrast);
  const setLayoutSettings = useViewSettingsStore((state) => state.actions.setLayoutSettings);
  const installItem = usePWAInstall();
  const isOnline = useIsOnline();
  const update = useAppUpdate();
  const [wakeLockEnabled, setWakeLockEnabled] = useLocalStorageState<boolean>(
    "wakeLockEnabled",
    { defaultValue: true },
  );
  const shouldKeepScreenAwake = keepSongScreenAwake && wakeLockEnabled;
  const { request, release, isSupported } = useWakeLock({
    reacquireOnPageVisible: shouldKeepScreenAwake,
  });

  useEffect(() => {
    if (!isSupported || !shouldKeepScreenAwake) return;
    const pendingRequest = request();
    return () => {
      void pendingRequest.then(release);
    };
  }, [isSupported, shouldKeepScreenAwake, request, release]);

  const appSettings = (
    <>
      <CompactItem.Header>App settings</CompactItem.Header>
      <DropdownMenuSeparator />
      <DropdownThemeToggle size={6} />
      <DropdownMenuCheckboxItem
        onSelect={(event) => event.preventDefault()}
        checked={highContrast}
        onCheckedChange={(checked) => setLayoutSettings({ highContrast: checked })}
      >
        <CompactItem.Shell>
          <CompactItem.Icon><Contrast /></CompactItem.Icon>
          <CompactItem.Body title="High contrast" />
        </CompactItem.Shell>
      </DropdownMenuCheckboxItem>
      {isSupported && (
        <DropdownMenuCheckboxItem
          onSelect={(event) => event.preventDefault()}
          checked={wakeLockEnabled}
          onCheckedChange={setWakeLockEnabled}
        >
          <CompactItem.Shell>
            <CompactItem.Icon><Coffee /></CompactItem.Icon>
            <CompactItem.Body title="Keep screen on" subtitle="While a song is open" />
          </CompactItem.Shell>
        </DropdownMenuCheckboxItem>
      )}
      <ResetBanListDropdownItems songs={songs} />
      {installItem}
      <DropdownMenuItem
        onSelect={(event) => {
          event.preventDefault();
          void runUpdateAction();
        }}
        disabled={
          !isOnline || !import.meta.env.PROD || !("serviceWorker" in navigator) ||
          ["checking", "downloading", "restarting"].includes(update)
        }
      >
        <CompactItem.Shell>
          <CompactItem.Icon><RefreshCw /></CompactItem.Icon>
          <CompactItem.Body
            title={`Currently on v${__APP_VERSION__}`}
            subtitle={isOnline ? updateLabels[update] : "Reconnect to check for updates"}
          />
        </CompactItem.Shell>
      </DropdownMenuItem>
    </>
  );

  return (
    <DropdownMenu modal={!!compactMenuItems}>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="circular"
          aria-label={compactMenuItems ? "Menu and settings" : "Settings"}
        >
          <Settings2 />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        {...toolbarPanelPlacement}
        className={`${songPanelClassName} w-80 max-w-[calc(100vw-2rem)] max-h-[min(85dvh,var(--radix-dropdown-menu-content-available-height))] overscroll-y-contain`}
      >
        {compactMenuItems}
        {!appSettingsLast && appSettings}
        <LayoutSettingsDropdownSection />
        <ChordSettingsDropdownMenu />
        {children}
        {appSettingsLast && appSettings}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
