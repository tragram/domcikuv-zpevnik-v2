import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import { CloudSync } from "lucide-react";
import { useState } from "react";
import { SessionsResponseData } from "src/worker/api/sessions";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { makeApiRequest } from "~/services/apiHelpers";
import { Songbook } from "~/services/songs";

interface SessionViewProps {
  isOnline: boolean;
  avatars: Songbook[];
}

const SessionView = ({ isOnline, avatars }: SessionViewProps) => {
  const context = useRouteContext({ from: "/" });
  const [isOpen, setIsOpen] = useState(false);

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery<SessionsResponseData>({
    queryKey: ["sessions"],
    queryFn: async () => {
      const response = await makeApiRequest(context.api.session.$get);
      return response.map((session) => ({
        ...session,
        createdAt: new Date(session.createdAt),
      }));
    },
    enabled: isOpen && isOnline,
    refetchInterval: isOpen ? 10000 : false,
  });

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

  const active = sessions && sessions.length > 0;

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
        {error && (
          <div className="px-2 py-2 text-sm text-destructive">
            Failed to load sessions
          </div>
        )}
        {!isLoading && !error && sessions?.length === 0 && (
          <div className="px-2 py-2 text-sm text-muted-foreground">
            No active sessions
          </div>
        )}
        {sessions && sessions.length > 0 && (
          <div className="max-h-64 overflow-y-auto">
            {sessions.map((session) => (
              <Link
                key={session.masterId}
                to="/feed/$masterId"
                params={{ masterId: session.masterId }}
                onClick={() => setIsOpen(false)}
                className="block"
              >
                <div className="flex items-center gap-3 w-full min-w-0 rounded-md px-2 py-2 hover:bg-accent transition-colors">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarImage
                      src={
                        avatars.find((a) => a.name === session.masterId)?.image
                      }
                    />
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SessionView;
