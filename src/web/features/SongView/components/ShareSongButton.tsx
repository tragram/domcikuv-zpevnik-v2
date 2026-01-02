import React, { useEffect } from "react";
import { FeedStatus } from "../SongView";
import { UserProfileData } from "src/worker/api/userProfile";
import {
  DropdownIconStart,
  DropdownMenuCheckboxItem,
  DropdownItemWithDescription,
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

  const getDescription = () => {
    if (onLine && showProfileLink) {
      return {
        text: "Click to log in and pick a nickname to enable feature.",
        className: "text-[0.6em] ml-9 -mt-1",
      };
    }
    if (!shareSession) {
      return {
        text: "Share your page with others - live.",
        className: "",
      };
    }
    if (shareSession && feedStatus && feedStatus.connectedClients > 0) {
      return {
        text: `Connected clients: ${feedStatus.connectedClients}`,
        className: "mb-1",
      };
    }
    if (shareSession && user.loggedIn && user.profile.nickname) {
      return {
        text: `Your session can be viewed at ${window.location.host}/feed/${user.profile.nickname}`,
        className: "",
      };
    }
    return null;
  };

  const description = getDescription();

  const content = (
    <DropdownItemWithDescription
      title="Share current song"
      description={description?.text}
      descriptionClassName={description?.className}
    />
  );

  const wrappedContent =
    onLine && showProfileLink ? (
      <Link to={`/profile?redirect=${location.pathname}`}>{content}</Link>
    ) : (
      content
    );

  return (
    <DropdownMenuCheckboxItem
      onSelect={(e) => e.preventDefault()}
      disabled={showProfileLink}
      checked={shareSession}
      onCheckedChange={() => setShareSession(!shareSession)}
    >
      <DropdownIconStart icon={<CloudSync />} />
      {wrappedContent}
    </DropdownMenuCheckboxItem>
  );
};

export default ShareSongButton;
