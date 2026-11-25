import { Link, useSearch } from "@tanstack/react-router";
import {
  AtSign,
  CloudOff,
  Fullscreen,
  Heart,
  Pencil,
  PictureInPicture2,
  Undo2,
  Play,
} from "lucide-react";
import { useState, type FC } from "react";
import type { FullScreenHandle } from "react-full-screen";

import RandomSong from "~/components/RandomSong";
import { CompactItem } from "~/components/RichDropdown";
import ToolbarBase from "~/components/ToolbarBase";
import { ToolbarSettings } from "~/components/ToolbarSettings";
import { AvatarWithFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "~/components/ui/dropdown-menu";
import { useToggleFavorite } from "~/components/FavoriteButton";
import { useSongDB } from "~/hooks/use-songDB";
import { youtubeWatchUrl } from "src/lib/youtube";
import { SongData } from "~/types/songData";
import ShareSongButton from "../components/ShareSongButton";
import { SetNicknameDialog } from "../components/SetNicknameDialog";
import { YoutubeMiniPlayer } from "../components/YoutubeMiniPlayer";
import { useScrollHandler } from "../hooks/useScrollHandler";
import { FeedStatus } from "../hooks/useSessionSync";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { ChordSettingsButtons } from "./ChordSettingsMenu";
import { LayoutSettingsToolbar } from "./LayoutSettings";
import TransposeSettings from "./TransposeSettings";
import { UserData } from "src/web/hooks/use-user-data";
import { SongTranspose } from "../hooks/songTransposeMath";

interface ToolbarProps {
  songData: SongData;
  userData: UserData;
  transpose: SongTranspose;
  feedStatus: FeedStatus | undefined;
  fullScreenHandle: FullScreenHandle;
}

export const Toolbar: FC<ToolbarProps> = ({
  songData,
  userData,
  transpose,
  feedStatus,
  fullScreenHandle,
}) => {
  const {
    soundingKeyIndex,
    setSoundingKeyIndex,
    songbookPersonalization,
    resetKeyAndCapo,
    canResetKeyAndCapo,
  } = transpose;
  const { isFavorite, toggle: toggleFavorite } = useToggleFavorite(
    songData,
    userData?.profile.id ?? "",
    songbookPersonalization,
  );
  const [isYoutubeMiniPlayerOpen, setIsYoutubeMiniPlayerOpen] =
    useState(false);
  const youtubeTitle = isYoutubeMiniPlayerOpen
    ? "Close picture-in-picture"
    : "Watch in picture-in-picture";
  const fitScreenMode = useViewSettingsStore((state) => state.layout.fitScreenMode);
  const { isToolbarVisible } = useScrollHandler(fitScreenMode);
  const { songDB } = useSongDB(userData);
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
  const nickname = userData?.profile.nickname ?? null;

  const { version: versionId } = useSearch({ strict: false });

  return (
    <div className="absolute top-0 w-full">
      <ToolbarBase isVisible={isToolbarVisible}>
        <Button size="icon" variant="circular" asChild>
          <Link to="/">
            <Undo2 />
          </Link>
        </Button>

        <ChordSettingsButtons />
        <LayoutSettingsToolbar fullScreenHandle={fullScreenHandle} />
        <TransposeSettings
          soundingKeyIndex={soundingKeyIndex}
          setSoundingKeyIndex={setSoundingKeyIndex}
          canResetKeyAndCapo={canResetKeyAndCapo}
          resetKeyAndCapo={resetKeyAndCapo}
        />

        <Button
          size="icon"
          variant="circular"
          className="hidden lg:inline-flex"
          disabled={!songData.youtubeId}
          isActive={!!songData.youtubeId && isYoutubeMiniPlayerOpen}
          onClick={() => setIsYoutubeMiniPlayerOpen((open) => !open)}
          aria-label={songData.youtubeId ? youtubeTitle : "No YouTube video"}
          title={songData.youtubeId ? youtubeTitle : "No YouTube video"}
        >
          <PictureInPicture2 />
        </Button>

        {!feedStatus || !feedStatus.enabled || feedStatus.isMaster ? (
          <RandomSong
            songs={songDB.songs}
            currentSong={songData}
            userData={userData}
            languageCounts={songDB.languages}
            availableSongbooks={songDB.songbooks}
          />
        ) : (
          <Button
            size="icon"
            variant="circular"
            disabled
            className="!opacity-100"
          >
            {feedStatus?.isConnected ? (
              <AvatarWithFallback
                avatarSrc={feedStatus.sessionState?.masterAvatar ?? undefined}
                fallbackStr={feedStatus.sessionState?.masterNickname ?? "?"}
                avatarClassName="h-full w-full"
              />
            ) : (
              <CloudOff />
            )}
          </Button>
        )}

        <ToolbarSettings songs={songDB.songs} keepSongScreenAwake appSettingsLast>
          <CompactItem.Header>Song actions</CompactItem.Header>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              fullScreenHandle.enter();
            }}
          >
            <CompactItem.Shell>
              <CompactItem.Icon>
                <Fullscreen />
              </CompactItem.Icon>
              <CompactItem.Body title="Enter fullscreen" />
            </CompactItem.Shell>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="lg:hidden"
            asChild={!!songData.youtubeId}
            disabled={!songData.youtubeId}
          >
            {songData.youtubeId ? (
              <a
                className="w-full"
                href={youtubeWatchUrl(songData.youtubeId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CompactItem.Shell className="cursor-pointer w-full">
                  <CompactItem.Icon>
                    <Play />
                  </CompactItem.Icon>
                  <CompactItem.Body title="Watch on YouTube" />
                </CompactItem.Shell>
              </a>
            ) : (
              <CompactItem.Shell className="w-full">
                <CompactItem.Icon>
                  <Play />
                </CompactItem.Icon>
                <CompactItem.Body title="Watch on YouTube" />
              </CompactItem.Shell>
            )}
          </DropdownMenuItem>

          <ShareSongButton
            feedStatus={feedStatus}
            userData={userData}
            songId={songData.id}
          />

          {userData && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setNicknameDialogOpen(true);
              }}
            >
              <CompactItem.Shell>
                <CompactItem.Icon>
                  <AtSign />
                </CompactItem.Icon>
                <CompactItem.Body
                  title={
                    nickname
                      ? "Change sharing nickname"
                      : "Set a nickname to share"
                  }
                  subtitle={nickname ? `Sharing as ${nickname}` : undefined}
                />
              </CompactItem.Shell>
            </DropdownMenuItem>
          )}

          {userData && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                toggleFavorite();
              }}
            >
              <CompactItem.Shell>
                <CompactItem.Icon>
                  <Heart
                    className={isFavorite ? "fill-primary text-primary" : ""}
                  />
                </CompactItem.Icon>
                <CompactItem.Body
                  title={isFavorite ? "In your songbook" : "Add to songbook"}
                  subtitle={
                    isFavorite
                      ? "Your key & capo for this song are saved here"
                      : "Adds song to your songbook and remembers the selected key & capo"
                  }
                />
              </CompactItem.Shell>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem>
            <Link
              className="w-full"
              to="/edit/$songId"
              params={{ songId: songData.id }}
              search={{ version: versionId }}
            >
              <CompactItem.Shell className="cursor-pointer w-full">
                <CompactItem.Icon>
                  <Pencil />
                </CompactItem.Icon>
                <CompactItem.Body title="View in Editor" />
              </CompactItem.Shell>
            </Link>
          </DropdownMenuItem>
        </ToolbarSettings>
      </ToolbarBase>
      <SetNicknameDialog
        open={nicknameDialogOpen}
        onOpenChange={setNicknameDialogOpen}
      />
      {isYoutubeMiniPlayerOpen && songData.youtubeId && (
        <YoutubeMiniPlayer
          youtubeId={songData.youtubeId}
          onClose={() => setIsYoutubeMiniPlayerOpen(false)}
        />
      )}
    </div>
  );
};
