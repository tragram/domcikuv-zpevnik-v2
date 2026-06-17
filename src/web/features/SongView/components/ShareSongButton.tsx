import React from "react";

import { DropdownMenuCheckboxItem } from "~/components/ui/dropdown-menu";
import { CloudSync } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useIsOnline } from "~/hooks/use-is-online";
import { CompactItem } from "~/components/RichDropdown";
import { FeedStatus } from "../hooks/useSessionSync";
import { UserData } from "src/web/hooks/use-user-data";
import { useEnableShareSessionAfterAuth } from "src/web/hooks/use-enable-share-session-after-auth";
import { useShareSessionToggle } from "../hooks/useShareSessionToggle";

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

  const { shareSession, toggleShareSession } = useShareSessionToggle();

  const { scheduleEnable } = useEnableShareSessionAfterAuth(userData);

  const isFollowing = !!feedStatus?.enabled && !feedStatus.isMaster;

  const getDescription = () => {
    if (!onLine) return { text: "You need to be online to use this feature" };
    if (onLine && showProfileLink)
      return {
        text: (
          <>
            <span className="underline">Log in</span> to enable this feature
          </>
        ),
      };
    if (feedStatus?.relay?.loopDetected) {
      return { text: "Relay paused — a master loop was detected" };
    }
    if (feedStatus?.relay?.active) {
      const originator =
        feedStatus.relay.originatorNickname ??
        feedStatus.sessionState?.masterNickname ??
        "this";
      return {
        text: `Relaying ${originator}'s session to your own followers`,
      };
    }
    if (isFollowing && !shareSession) {
      return {
        text: `Enable to relay ${
          feedStatus?.sessionState?.masterNickname ?? "master"
        }'s session to your own followers`,
      };
    }
    // Sharing is addressed by nickname only — prompt the user to set one first.
    if (userData && !userData.profile.nickname) {
      return { text: "Set a nickname (in your profile) to share your session" };
    }
    if (!shareSession) return { text: "Share your page with others - live" };
    if (shareSession && userData?.profile.nickname) {
      return {
        text: `Your session can be viewed at ${window.location.host}/feed/${userData.profile.nickname}`,
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

  // Logged-in users can always toggle sharing — including from a feed page,
  // where enabling it starts relaying the viewed session to their followers.
  const checkboxDisabled = !onLine || showProfileLink;
  return (
    <DropdownMenuCheckboxItem
      onSelect={(e) => e.preventDefault()}
      checked={shareSession}
      onCheckedChange={() => {
        if (checkboxDisabled) return;
        toggleShareSession(!shareSession);
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
