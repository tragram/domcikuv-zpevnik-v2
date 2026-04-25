import React from "react";

import { DropdownMenuCheckboxItem } from "~/components/ui/dropdown-menu";
import { CloudSync } from "lucide-react";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { Link } from "@tanstack/react-router";
import { useIsOnline } from "~/hooks/use-is-online";
import { CompactItem } from "~/components/RichDropdown";
import { FeedStatus } from "../hooks/useSessionSync";
import { UserData } from "src/web/hooks/use-user-data";
import { useEnableShareSessionAfterAuth } from "src/web/hooks/use-enable-share-session-after-auth";

interface ShareSongButtonProps {
  feedStatus: FeedStatus | undefined;
  userData: UserData;
  songId: string;
}

const ShareSongButton: React.FC<ShareSongButtonProps> = ({
  feedStatus,
  userData,
  songId,
}) => {
  const onLine = useIsOnline();
  const showProfileLink = !userData;

  const shareSession = useViewSettingsStore((state) => state.shareSession);
  const setShareSession = useViewSettingsStore(
    (state) => state.actions.setShareSession,
  );

  const { scheduleEnable } = useEnableShareSessionAfterAuth(userData);

  const getDescription = () => {
    if (!onLine) return { text: "You need to be online to use this feature" };
    if (onLine && showProfileLink)
      return { text: <><span className="underline">Log in</span> to enable this feature</> };
    if (feedStatus?.enabled && !feedStatus.isMaster) {
      return {
        text: `Currently connected to ${feedStatus.sessionState?.masterNickname || "someone else"
          }'s session`,
      };
    }
    if (!shareSession) return { text: "Share your page with others - live" };
    if (shareSession && userData) {
      const displayName = userData.profile.nickname || userData.profile.name;
      return {
        text: `Your session can be viewed at ${window.location.host}/feed/${displayName}`,
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
        onClick={scheduleEnable}
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
        if (feedStatus && feedStatus.enabled && !feedStatus.isMaster) return;
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
