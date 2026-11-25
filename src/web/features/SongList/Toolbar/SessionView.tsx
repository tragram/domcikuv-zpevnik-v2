import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudSync } from "lucide-react";
import { useEffect, useState } from "react";
import type { UserData } from "~/hooks/use-user-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RichItem } from "~/components/RichDropdown";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { activeSessionsQueryOptions } from "~/hooks/use-active-sessions";
import type { SongDB } from "~/types/types";
import { Button } from "src/web/components/ui/button";
import { AvatarWithFallback } from "src/web/components/ui/avatar";
import { useEnableShareSessionAfterAuth } from "src/web/hooks/use-enable-share-session-after-auth";
import { useShareSessionToggle } from "src/web/features/SongView/hooks/useShareSessionToggle";
import { SetNicknameDialog } from "src/web/features/SongView/components/SetNicknameDialog";

interface SessionViewProps {
  isOnline: boolean;
  songDB: SongDB;
  userData: UserData;
}

const SessionView = ({ isOnline, songDB, userData }: SessionViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const { data: sessions, isPending } = useQuery({
    ...activeSessionsQueryOptions(),
    enabled: isOnline,
    refetchInterval: isOpen ? 60_000 : false,
  });
  const activeSessions = sessions?.map((session) => ({
    ...session,
    song: songDB.songs.find((song) => song.id === session.songId),
  }));

  const { shareSession, toggleShareSession } = useShareSessionToggle();

  const showProfileLink = !userData;
  // Sharing is addressed by nickname only, so a nickname is required to share.
  const nickname = userData?.profile.nickname ?? null;

  const { scheduleEnable } = useEnableShareSessionAfterAuth(userData);

  useEffect(() => {
    if (!isOpen) return;

    // Visual timer tick: updates the "ago" text every second
    const clockInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [isOpen]);

  // Handle the initial state updates when the user clicks the dropdown
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setCurrentTime(Date.now());
      if (isOnline) void queryClient.prefetchQuery(activeSessionsQueryOptions());
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
    <>
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
        {!activeSessions && isPending && (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            Loading sessions…
          </div>
        )}
        {!activeSessions && !isPending && (
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
                    <div className="truncate text-sm w-[6rem] flex-shrink-0 text-foreground">
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
                onCheckedChange={toggleShareSession}
                disabled={!isOnline || !nickname}
              />
            </div>
            {nickname ? (
              <div className="text-xs text-muted-foreground pl-10">
                Sharing as <span className="font-medium">{nickname}</span> ·{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setNicknameDialogOpen(true)}
                >
                  change
                </button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground pl-10">
                <button
                  type="button"
                  className="underline"
                  onClick={() => setNicknameDialogOpen(true)}
                >
                  Set a nickname
                </button>{" "}
                to share your session.
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    <SetNicknameDialog
      open={nicknameDialogOpen}
      onOpenChange={setNicknameDialogOpen}
    />
    </>
  );
};

export default SessionView;
