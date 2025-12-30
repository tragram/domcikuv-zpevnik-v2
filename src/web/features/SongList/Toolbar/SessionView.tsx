import { Link } from "@tanstack/react-router";
import { CloudSync } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useActiveSessions } from "~/hooks/use-active-sessions";

interface SessionViewProps {
  isOnline: boolean;
}

const SessionView = ({ isOnline }: SessionViewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const { activeSessions, refetchIfStale } = useActiveSessions();

  // Update time every second when dropdown is open
  useEffect(() => {
    if (isOpen) {
      // Update time immediately when dropdown opens
      setCurrentTime(Date.now());
      refetchIfStale(0.5);

      const interval = setInterval(() => {
        if (isOpen) {
          setCurrentTime(Date.now());
          refetchIfStale(1);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const getTimeSince = (date: Date) => {
    const diff = currentTime - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const getInitials = (masterId: string) => {
    return masterId.slice(0, 2).toUpperCase();
  };

  const active = activeSessions && activeSessions.length > 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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
      <DropdownMenuContent
        className="m-2 w-[calc(100dvw-1rem)] sm:w-96"
        align="start"
      >
        <DropdownMenuLabel className="text-sm font-semibold">
          Active Sessions
        </DropdownMenuLabel>
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
          <div className="max-h-64 overflow-y-auto">
            {activeSessions.map((session) => (
              <Link
                key={session.masterId}
                to="/feed/$masterId"
                params={{ masterId: session.masterId }}
                onClick={() => setIsOpen(false)}
                className="block"
              >
                <div className="flex items-center gap-3 w-full min-w-0 rounded-md px-2 py-2 hover:bg-accent transition-colors">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarImage src={session.avatar} />
                    <AvatarFallback className="text-xs">
                      {getInitials(session.masterId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-3 min-w-0 flex-1 justify-between">
                    <div className="truncate text-sm w-[4rem] flex-shrink-0">
                      {session.masterId}
                    </div>
                    <div className="text-xs hidden xs:flex flex-col flex-1 min-w-0 text-center">
                      {session.song && (
                        <>
                          <div className="truncate text-white/80">
                            {session.song.artist}
                          </div>
                          <div className="truncate text-white/80">
                            {session.song.title}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="text-xs text-primary/80 w-[2rem] flex-shrink-0 text-center">
                      {getTimeSince(session.createdAt)}
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
        <p className="px-2 py-2 text-xs">
          To share your own sesion, just log in, pick a nickname and enable the
          feature in song settings!
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SessionView;
