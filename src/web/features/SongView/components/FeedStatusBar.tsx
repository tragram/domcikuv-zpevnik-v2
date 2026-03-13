import { useState, useEffect } from "react";
import { useIsOnline } from "~/hooks/use-is-online";
import { FeedStatus } from "../hooks/useSessionSync";

interface FeedStatusBarProps {
  feedStatus?: FeedStatus;
}

export const FeedStatusBar = ({ feedStatus }: FeedStatusBarProps) => {
  const isOnline = useIsOnline();
  const [isReadyToDisplay, setIsReadyToDisplay] = useState(false);

  useEffect(() => {
    // Wait 150ms before fading the text in. This masks the WS handshake to prevent the "connecting" blip
    const timer = setTimeout(() => setIsReadyToDisplay(true), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!feedStatus?.enabled) return null;

  let statusMessage: React.ReactNode = "";

  if (!isOnline) {
    statusMessage = "Offline. Reconnect to internet to sync.";
  } else if (feedStatus.isMaster) {
    switch (feedStatus.connectionStatus) {
      case "connecting":
        statusMessage = "Starting session broadcast...";
        break;
      case "reconnecting":
        statusMessage = `Reconnecting... (Attempt ${feedStatus.retryAttempt})`;
        break;
      case "kicked":
        statusMessage = (
          <>
            Your session was taken over by another device. <wbr />
            Reload to restore control.
          </>
        );
        break;
      case "connected":
        statusMessage = `Sharing session · ${feedStatus.connectedClients ?? 0} connected`;
        break;
      default:
        statusMessage = "Disconnected from feed server.";
    }
  } else {
    switch (feedStatus.connectionStatus) {
      case "connecting":
        statusMessage = "Connecting to feed...";
        break;
      case "reconnecting":
        statusMessage = "Lost connection to feed, reconnecting...";
        break;
      case "connected":
        // If connected but we receive a null masterNickname, the host is not actively in the session
        if (!feedStatus.sessionState?.masterNickname) {
          statusMessage = "Waiting for master to join the session...";
        } else {
          statusMessage = `Following ${feedStatus.sessionState.masterNickname}'s feed`;
        }
        break;
      default:
        statusMessage = "Disconnected from feed server.";
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-fit w-full py-2 px-4 text-center flex justify-center items-center text-primary bg-glass/30 dark:bg-glass/90 dark:text-white/70 text-xs backdrop-blur-md border-primary dark:border-primary/30 border-t-2 z-50 whitespace-nowrap">
      <span
        className={`transition-opacity duration-300 ease-in-out ${
          isReadyToDisplay ? "opacity-100" : "opacity-0"
        }`}
      >
        {statusMessage}
      </span>
    </div>
  );
};
