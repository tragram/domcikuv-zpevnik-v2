import { useState, useEffect } from "react";
import { useIsOnline } from "~/hooks/use-is-online";
import { FeedStatus } from "../hooks/useSessionSync";

interface FeedStatusBarProps {
  feedStatus?: FeedStatus;
}

export const FeedStatusBar = ({ feedStatus }: FeedStatusBarProps) => {
  const isOnline = useIsOnline();

  // Debounce the connected count so transient dips (a follower reloading, which
  // briefly drops then re-adds it) don't flicker the number on screen.
  // When rawCount is undefined (no server message yet), bypass the debounce.
  const rawCount = feedStatus?.connectedClients;
  const [debouncedCount, setDebouncedCount] = useState<number | undefined>(
    rawCount,
  );
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCount(rawCount), 500);
    return () => clearTimeout(timer);
  }, [rawCount]);
  const count = rawCount === undefined ? undefined : debouncedCount;

  if (!feedStatus?.enabled) return null;

  let statusMessage: React.ReactNode = "";

  if (!isOnline) {
    statusMessage = "Offline. Reconnect to internet to sync.";
  } else if (feedStatus.relay?.loopDetected) {
    // ── Relay master: loop detected in the chain (master-facing only) ─────
    const stuck = feedStatus.relay.loopSize ?? 0;
    statusMessage = `⚠ Relay loop detected — ${stuck} session${stuck === 1 ? "" : "s"} stuck. Pick a different song to break it. ⚠`;
  } else if (feedStatus.relay?.active) {
    // ── Relay master: actively relaying upstream content ──────────────────
    const originator = feedStatus.relay.originatorNickname ?? "someone";
    statusMessage = (
      <>
        Relaying {originator}'s session
        {count !== undefined && <span className="hidden sm:inline"> · {count} connected</span>}
      </>
    );
  } else if (feedStatus.isMaster) {
    // ── Standalone master broadcasting their own session ──────────────────
    switch (feedStatus.connectionStatus) {
      case "connecting":
        statusMessage = "Starting session broadcast...";
        break;
      case "reconnecting":
        statusMessage = `Reconnecting... (Attempt ${feedStatus.retryAttempt})`;
        break;
      case "connected":
        statusMessage = count !== undefined ? (
          <>
            Sharing session<span className="hidden sm:inline"> · {count} connected</span>
          </>
        ) : (
          ""
        );
        break;
      default:
        statusMessage = "Disconnected from feed server.";
    }
  } else {
    // ── Follower ──────────────────────────────────────────────────────────
    switch (feedStatus.connectionStatus) {
      case "connecting":
        statusMessage = "Connecting to feed...";
        break;
      case "reconnecting":
        statusMessage = "Lost connection to feed, reconnecting...";
        break;
      case "connected": {
        const state = feedStatus.sessionState;
        const masterName = state?.masterNickname ?? "The master";
        const isActivelyConnected =
          state?.isMasterConnected ?? !!state?.masterNickname;

        if (!isActivelyConnected) {
          // We keep showing the last (stale) song, so frame it as "stopped"
          // rather than "looking" once a song has been seen.
          statusMessage = state?.songId
            ? `${masterName} has stopped sharing.`
            : `${masterName} is looking for a song to play...`;
        } else {
          // Note when the content arrives through a relay chain.
          const chainLength = state?.chainPath?.length ?? 0;
          const originator = state?.originatorNickname;
          statusMessage =
            chainLength > 1 && originator && originator !== masterName
              ? (
                  <>
                    Following {masterName}'s relay<span className="hidden xs:inline"> · originated by {originator}</span>
                  </>
                )
              : `Following ${masterName}'s feed`;
        }
        break;
      }
      default:
        statusMessage = "Disconnected from feed server.";
    }
  }

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 h-fit w-full
        py-2 px-4
        flex justify-center items-center
        text-center text-primary text-xs
        bg-glass/30 dark:bg-glass/90
        dark:text-white/70
        backdrop-blur-md
        border-t-2 border-primary dark:border-primary/30
        z-50
        transition-opacity duration-300 ease-in-out
        ${count !== undefined ? "opacity-100" : "opacity-0"}
      `}
    >
      <span>{statusMessage}</span>
    </div>
  );
};
