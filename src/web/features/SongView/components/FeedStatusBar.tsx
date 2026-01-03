import { FeedStatus } from "../SongView";

interface FeedStatusBarProps {
  feedStatus?: FeedStatus;
}

export const FeedStatusBar = ({ feedStatus }: FeedStatusBarProps) => {
  if (!feedStatus?.enabled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 w-full flex justify-center items-center text-primary bg-glass/30 dark:bg-glass/90 dark:text-white/70 text-xs backdrop-blur-md border-primary dark:border-primary/30 border-t-2 z-50">
      {feedStatus?.isMaster
        ? `Sharing session · ${feedStatus.connectedClients} connected`
        : `Following ${
            feedStatus && feedStatus.sessionState?.masterNickname
          }'s feed`}
    </div>
  );
};