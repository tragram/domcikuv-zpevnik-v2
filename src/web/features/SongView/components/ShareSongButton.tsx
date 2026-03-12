import React from "react";
import { FeedStatus } from "../SongView";
import { UserProfileData } from "src/worker/api/userProfile";
import { DropdownMenuCheckboxItem } from "~/components/ui/dropdown-menu";
import { CloudSync } from "lucide-react";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { Link } from "@tanstack/react-router";
import { useIsOnline } from "~/hooks/use-is-online";
import { CompactItem } from "~/components/RichDropdown";

interface ShareSongButtonProps {
  feedStatus: FeedStatus | undefined;
  user: UserProfileData;
  songId: string;
}

const ShareSongButton: React.FC<ShareSongButtonProps> = ({
  feedStatus,
  user,
  songId,
}) => {
  const onLine = useIsOnline();
  const showProfileLink = !user.loggedIn || !user.profile.nickname;

  const shareSession = useViewSettingsStore((state) => state.shareSession);
  const setShareSession = useViewSettingsStore(
    (state) => state.actions.setShareSession,
  );

  const getDescription = () => {
    if (!onLine) return { text: "You need to be online to use this feature" };
    if (onLine && showProfileLink)
      return { text: "Click to log in & pick a nickname to enable" };
    if (feedStatus?.enabled && !feedStatus.isMaster) {
      return {
        text: `Currently connected to ${
          feedStatus.sessionState?.masterNickname || "someone else"
        }'s session`,
      };
    }
    if (!shareSession) return { text: "Share your page with others - live" };
    if (shareSession && user.loggedIn && user.profile.nickname) {
      return {
        text: `Your session can be viewed at ${window.location.host}/feed/${user.profile.nickname}`,
      };
    }
    return null;
  };

  const description = getDescription();

  const content = (
    <CompactItem.Body title="Share current song" subtitle={description?.text} />
  );

  const wrappedContent =
    onLine && showProfileLink ? (
      <Link
        to="/profile"
        search={{ redirect: `/song/${songId}` }}
        className="w-full"
      >
        {content}
      </Link>
    ) : (
      content
    );

  const checkboxDisabled =
    !onLine || showProfileLink || (feedStatus?.enabled && !feedStatus.isMaster);

  return (
    <DropdownMenuCheckboxItem
      onSelect={(e) => e.preventDefault()}
      checked={shareSession}
      onCheckedChange={() => {
        if (checkboxDisabled) return;
        // avoid two tabs open (master + follower) e.g. during testing and then follower disabling the sharing all the time
        if (feedStatus && !feedStatus.isMaster) return;
        setShareSession(!shareSession);
      }}
      className={checkboxDisabled ? "opacity-50" : ""}
    >
      <CompactItem.Shell className="w-full">
        <CompactItem.Icon>
          <CloudSync />
        </CompactItem.Icon>
        {wrappedContent}
      </CompactItem.Shell>
    </DropdownMenuCheckboxItem>
  );
};

export default ShareSongButton;
