import { Link } from "@tanstack/react-router";
import { CloudSync } from "lucide-react";
import { useEffect, useState } from "react";
import { useUserData } from "src/web/hooks/use-user-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RichItem } from "~/components/RichDropdown";
import { useViewSettingsStore } from "src/web/features/SongView/hooks/viewSettingsStore";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useActiveSessions } from "~/hooks/use-active-sessions";
import { useSongDB } from "~/hooks/use-songDB";
import { Button } from "src/web/components/ui/button";
import { AvatarWithFallback } from "src/web/components/ui/avatar";
import { useEnableShareSessionAfterAuth } from "src/web/hooks/use-enable-share-session-after-auth";

interface SessionViewProps {
  isOnline: boolean;
}

const SessionView = ({ isOnline }: SessionViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const { userData } = useUserData();
  const { songDB } = useSongDB(userData);
  const { activeSessions, refetchIfStale } = useActiveSessions(songDB);

  const shareSession = useViewSettingsStore((state) => state.shareSession);
  const setShareSession = useViewSettingsStore(
    (state) => state.actions.setShareSession,
  );

  const showProfileLink = !userData;
  const showNicknameRecommendation = userData && !userData.profile.nickname;

  const { scheduleEnable } = useEnableShareSessionAfterAuth(userData);

  useEffect(() => {
    if (!isOpen) return;

    // Visual timer tick: updates the "ago" text every second
    const clockInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    // Network tick: polls the backend for new sessions every 10 seconds
    const networkInterval = setInterval(() => {
      refetchIfStale(10 / 60);
    }, 5000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(networkInterval);
    };
  }, [isOpen, refetchIfStale]);

  // Handle the initial state updates when the user clicks the dropdown
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setCurrentTime(Date.now());
      refetchIfStale(0); // Fetch immediately on open
    }
  };

  const getTimeSince = (date: Date) => {
    const diff = currentTime - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const active = activeSessions && activeSessions.length > 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      {/* Tooltip wraps the Dropdown trigger */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="circular"
              disabled={!isOnline}
              isActive={active}
            >
              <CloudSync />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Active Sessions</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        className="m-2 w-[calc(100dvw-1rem)] sm:w-96 text-foreground/80"
        align="start"
      >
        <RichItem.Header>Active Sessions</RichItem.Header>
        <DropdownMenuSeparator />
        {!activeSessions && (
          <div className="px-2 py-2 text-sm text-destructive">
            Failed to load sessions
          </div>
        )}
        {activeSessions?.length === 0 && (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            No active sessions
          </div>
        )}
        {activeSessions && activeSessions.length > 0 && (
          <div className="max-h-64 overflow-y-auto pr-1">
            {activeSessions.map((session) => (
              <Link
                key={session.masterId}
                to="/feed/$masterNickname"
                params={{ masterNickname: session.nickname }}
                onClick={() => setIsOpen(false)}
                className="block"
              >
                <div className="flex items-center gap-3 w-full min-w-0 rounded-md px-2 py-2 hover:bg-accent transition-colors">
                  <AvatarWithFallback
                    avatarSrc={session.avatar}
                    fallbackStr={session.nickname}
                    avatarClassName="h-7 w-7 flex-shrink-0"
                    fallbackClassName="text-xs"
                  />
                  <div className="flex items-center gap-3 min-w-0 flex-1 justify-between">
                    <div className="truncate text-sm w-[6rem] flex-shrink-0 dark:text-white">
                      {session.nickname}
                    </div>
                    <div className="text-xs hidden xs:flex flex-col flex-1 min-w-0 text-center">
                      {session.song && (
                        <>
                          <div className="truncate">
                            {session.song.artist}
                          </div>
                          <div className="truncate">
                            {session.song.title}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-primary/80 w-[2rem] flex-shrink-0 text-center">
                      {getTimeSince(session.timestamp)}
                      <br />
                      ago
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        {isOnline && showProfileLink ? (
          <Link
            to="/profile"
            search={{ redirect: window.location.pathname }}
            className="block"
            onClick={scheduleEnable}
          >
            <div className="flex items-center gap-3 w-full rounded-md px-2 py-2 hover:bg-accent transition-colors text-sm">
              <RichItem.Icon size={7}><CloudSync /></RichItem.Icon>
              <span><span className="underline">Log in</span> to share your session!</span>
            </div>
          </Link>
        ) : (
          <div className="flex flex-col w-full px-2 py-2">
            <div className="flex items-center justify-between w-full">
              <div className={`flex items-center gap-3 text-sm ${!isOnline ? "opacity-50" : ""}`}>
                <RichItem.Icon size={7}><CloudSync /></RichItem.Icon>
                <span>Share your session</span>
              </div>
              <Switch
                checked={shareSession}
                onCheckedChange={setShareSession}
                disabled={!isOnline}
              />
            </div>
            {showNicknameRecommendation && (
              <div className="text-xs text-muted-foreground pl-10">
                Tip: <Link to="/profile" className="underline">Set a nickname</Link> for a better sharing link.
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SessionView;
