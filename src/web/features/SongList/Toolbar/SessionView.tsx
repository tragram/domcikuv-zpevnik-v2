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

  // keep activeSessions more up to date when this is open
  const { data: activeSessions, isLoading } = useQuery({
    queryKey: ["activeSessions"],
    queryFn: () => fetchActiveSessions(context.api),
    staleTime: 1000 * 60 * 60 * 24,
    initialData: context.activeSessions, // Use the preloaded data
  });

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
      }
    }
  }, [isOpen, queryClient]);

  const getTimeSince = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ago`;
    }
    return `${minutes}m ago`;
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
        className="w-80 max-w-11/12"
        align="start"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-sm font-semibold">
          Active Sessions
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            Loading...
          </div>
        )}
        {!isLoading && !activeSessions && (
          <div className="px-2 py-2 text-sm text-destructive">
            Failed to load sessions
          </div>
        )}
        {!isLoading && activeSessions?.length === 0 && (
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
                  <div className="truncate flex-1 text-sm ">
                    {session.masterId}
                  </div>
                  <div className="text-xs text-primary/80 flex-shrink-0">
                    {getTimeSince(session.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <p className="px-2 py-2 text-xs">
          To share your own sesion, just log in, pick a nickname and enable the feature in song settings!
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SessionView;
