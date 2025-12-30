import React, { useEffect } from "react";
import { FeedStatus } from "../SongView";
import { UserProfileData } from "src/worker/api/userProfile";
import {
  DropdownIconStart,
  DropdownMenuCheckboxItem,
} from "~/components/ui/dropdown-menu";
import { CloudSync } from "lucide-react";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { Link } from "@tanstack/react-router";

interface ShareSongButtonProps {
  feedStatus: FeedStatus | undefined;
  user: UserProfileData;
}

const ShareSongButton: React.FC<ShareSongButtonProps> = ({
  feedStatus,
  user,
}) => {
  const onLine = window.navigator.onLine;
  const showProfileLink = !user.loggedIn || !user.profile.nickname;
  const { shareSession, actions } = useViewSettingsStore();
  const setShareSession = actions.setShareSession;

  useEffect(() => {
    if (!user.loggedIn) {
      setShareSession(false);
    }
  }, [setShareSession, user.loggedIn]);

  const baseButton = (
    <DropdownMenuCheckboxItem
      onSelect={(e) => e.preventDefault()}
      disabled={showProfileLink}
      checked={shareSession}
      onCheckedChange={() => setShareSession(!shareSession)}
    >
      <DropdownIconStart icon={<CloudSync />} />

      <div>
        Share current song
        {!shareSession && (
          <p className="text-[0.7em] leading-tight">
            Share your page with others - live.
          </p>
        )}
        {shareSession && feedStatus && feedStatus.connectedClients > 0 && (
          <p className="text-[0.7em] leading-tight mb-1">
            Connected clients: {feedStatus.connectedClients}
          </p>
        )}
        {shareSession && user.loggedIn && user.profile.nickname && (
          <p className="text-[0.7em] leading-tight">
            Your session can be viewed at {window.location.host}/feed/
            {user.profile.nickname}
          </p>
        )}
      </div>
    </DropdownMenuCheckboxItem>
  );

  return onLine && showProfileLink ? (
    <Link to={`/profile?redirect=${location.pathname}`}
    >
      {baseButton}
      <p className="text-[0.6em] leading-tight ml-9 -mt-1">
        Click to log in and pick a nickname to enable feature.
      </p>
    </Link>
  ) : (
    baseButton
  );
};

export default ShareSongButton;
