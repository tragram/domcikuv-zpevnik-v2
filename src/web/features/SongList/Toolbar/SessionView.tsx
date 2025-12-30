import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
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
import { fetchActiveSessions } from "~/services/users";

interface SessionViewProps {
  isOnline: boolean;
}

const SessionView = ({ isOnline }: SessionViewProps) => {
  const context = useRouteContext({ from: "/" });
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const songs = context.songDB.songs;

  // Subscribe to the query to get live updates
  const { data: activeSessionsData } = useQuery({
    queryKey: ["activeSessions"],
    queryFn: () => fetchActiveSessions(context.api),
    staleTime: 1000 * 60 * 60 * 24, // Match the staleTime from root
    initialData: context.activeSessions, // Use context data as initial value
  });

  const activeSessions = activeSessionsData?.map((as) => {
    return { ...as, song: songs.find((s) => s.id === as.songId) };
  });

  // Update time every second when dropdown is open
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Refetch when dropdown opens if data is older than 1 minute
  useEffect(() => {
    if (isOpen) {
      const queryState = queryClient.getQueryState(["activeSessions"]);

      if (queryState?.dataUpdatedAt) {
        const ageInMinutes =
          (Date.now() - queryState.dataUpdatedAt) / (1000 * 60);
        if (ageInMinutes > 1) {
          queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
        }
      } else {
        // If no data exists yet, invalidate to trigger fetch
        queryClient.invalidateQueries({ queryKey: ["activeSessions"] });
      }
    }
  }, [isOpen, queryClient]);

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
        className="w-80 xs:w-96 max-w-11/12"
        align="start"
        sideOffset={8}
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
