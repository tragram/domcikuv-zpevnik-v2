import { useIsOnline } from "~/hooks/use-is-online";
import { FeedStatus } from "../SongView";

interface FeedStatusBarProps {
  feedStatus?: FeedStatus;
}

export const FeedStatusBar = ({ feedStatus }: FeedStatusBarProps) => {
  const isOnline = useIsOnline();
  if (!feedStatus?.enabled) return null;
  const masterStatus = isOnline ? (
    feedStatus.isConnected ? (
      `Sharing session · ${feedStatus.connectedClients} connected`
    ) : (
      <>
        Your session was taken over by another device. <wbr />
        Reload to restore control.
      </>
    )
  ) : (
    "Reconnect to internet to keep sharing your session"
  );

  const followerStatus = feedStatus.isConnected
    ? `Following ${feedStatus.sessionState?.masterNickname}'s feed`
    : `Reconnect to internet to keep following ${feedStatus.sessionState?.masterNickname}`;

  const statusMessage = feedStatus?.isMaster ? masterStatus : followerStatus;
  return (
    <div className="fixed bottom-0 left-0 right-0 h-fit w-full py-2 px-4 text-center flex justify-center items-center text-primary bg-glass/30 dark:bg-glass/90 dark:text-white/70 text-xs backdrop-blur-md border-primary dark:border-primary/30 border-t-2 z-50 whitespace-nowrap">
      {statusMessage}
    </div>
  );
};
