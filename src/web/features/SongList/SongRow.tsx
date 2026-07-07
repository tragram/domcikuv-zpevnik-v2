import { Link } from "@tanstack/react-router";
import { Check, VideoOff } from "lucide-react";
import { memo } from "react";
import { UserData } from "src/web/hooks/use-user-data";

import CircularProgress from "~/components/circular-progress";
import { FavoriteButton } from "~/components/FavoriteButton";
import { IllustrationPopup } from "~/components/IllustrationPopup";
import LanguageFlag from "~/components/LanguageFlag";
import { Avatar, AvatarImage } from "~/components/ui/avatar";
import { YoutubeButton } from "~/components/YoutubeButton";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";

interface SongInfoProps {
  title: string;
  artist: string;
  className?: string;
}

const SongInfo = memo(({ title, artist, className = "" }: SongInfoProps) => (
  <div className={cn("min-w-36 flex-col content-center text-left", className)}>
    <h2 className="song-title truncate text-sm font-bold">{title}</h2>
    <h3 className="song-artist truncate text-sm opacity-50 hc:opacity-80">
      {artist}
    </h3>
  </div>
));

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

interface DateDisplayProps {
  month?: number;
  year?: number;
  className?: string;
}

const DateDisplay = memo(
  ({ month, year, className = "" }: DateDisplayProps) => (
    <div
      className={cn(
        "min-w-20 flex-col content-center justify-center text-center",
        className,
      )}
    >
      {month && year && (
        <>
          <h3 className="text-xs opacity-70 hc:opacity-80">
            {MONTH_NAMES[month - 1]}
          </h3>
          <h2 className="text-sm opacity-70 hc:opacity-80">{year}</h2>
        </>
      )}
    </div>
  ),
);

interface VocalRangeIndicatorProps {
  songRangeSemitones: number | undefined;
  maxRange: number | undefined;
  className?: string;
}

interface CapoDisplayProps {
  capo: number;
  className?: string;
}

const CapoDisplay = memo(({ capo, className = "" }: CapoDisplayProps) => (
  <div
    className={cn(
      "min-w-12 flex-col content-center justify-center text-center",
      className,
    )}
  >
    <h2 className="text-xs opacity-70 hc:opacity-80">Capo</h2>
    <h3 className="text-sm opacity-70 hc:opacity-80">{capo}</h3>
  </div>
));

const VocalRangeIndicator = memo(
  ({
    songRangeSemitones,
    maxRange,
    className = "",
  }: VocalRangeIndicatorProps) => {
    const innerHTML =
      songRangeSemitones && maxRange ? (
        <CircularProgress value={songRangeSemitones} maxValue={maxRange} />
      ) : (
        <></>
      );
    return (
      <div className={cn("min-w-12 content-center justify-center", className)}>
        <div className="flex items-center">{innerHTML}</div>
      </div>
    );
  },
);

interface SongRowProps {
  song: SongData;
  maxRange?: number | undefined;
  userData: UserData;
  externalSearch?: boolean;
  // Owner userId when this list is filtered to a single other user's songbook;
  // opens the song in that owner's key/capo/version context.
  songbookOwner?: string;
  // Playlist-building mode: the avatar becomes a checkbox and clicking the row
  // toggles selection instead of navigating to the song.
  playlistMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (song: SongData) => void;
}
const SongRow = memo(
  ({
    song,
    maxRange,
    userData,
    externalSearch = false,
    songbookOwner,
    playlistMode = false,
    isSelected = false,
    onToggleSelect,
  }: SongRowProps) => {
    if (!song) {
      console.error("Invalid song provided to SongRow", song);
      return (
        <div className="text-foreground container mx-auto flex h-[70px] max-w-3xl items-center bg-white px-2 sm:px-4">
          Invalid song
        </div>
      );
    }
    const externalSourceId = song.externalSource?.sourceId;
    if (externalSearch && (!externalSourceId || !song.url())) {
      console.error("Invalid external song provided to SongRow", song);
      return null;
    }

    // In playlist mode only songs with a YouTube video can be selected.
    const hasVideo = !!song.youtubeId;

    const linkClassName =
      "song-row bg-glass/60 hover:bg-glass/90 relative flex h-12 w-full rounded-full backdrop-blur-lg";

    const linkInnerContent = (
      <>
        <div className="relative flex min-w-[72px] content-center justify-center rounded-l-full" />

        <SongInfo
          title={song.title}
          artist={song.artist}
          className="flex-auto"
        />

        {song.youtubeId && !externalSearch && (
          <YoutubeButton
            youtubeId={song.youtubeId}
            className="hidden shrink-0 xsm:flex"
          />
        )}

        {userData && !externalSearch && (
          <FavoriteButton
            song={song}
            userId={userData.profile.id}
            className="hidden shrink-0 basis-1/12 xs:flex"
          />
        )}

        <DateDisplay
          month={song.createdAt.getMonth() + 1}
          year={song.createdAt.getFullYear()}
          className="sm:flex hidden shrink-0 basis-2/12 md:basis-1/12"
        />

        <CapoDisplay
          capo={song.capo !== undefined ? song.capo : 0}
          className="hidden shrink-0 basis-1/12 lg:flex"
        />

        <VocalRangeIndicator
          songRangeSemitones={song.range?.semitones}
          maxRange={maxRange}
          className="hidden shrink-0 basis-1/12 md:flex"
        />

        <div className="flex min-w-10 shrink-0 basis-[5%] items-center justify-end p-2">
          {!externalSearch && song.language && (
            <LanguageFlag language={song.language} />
          )}
        </div>
      </>
    );

    return (
      <div className="song-row-wrapper container mx-auto flex h-[70px] max-w-3xl items-center px-2 sm:px-4 !pl-4 !sm:pl-6">
        <div
          className="song-row-bg-image flex h-14 w-full min-w-72 rounded-full hc:border-foreground hc:border-4 hc:!bg-none"
          style={{ backgroundImage: `url("${song.thumbnailURL()}")` }}
        >
          <div className="song-row-bg-image row-text-shadow relative flex h-full w-full items-center rounded-full shadow-black backdrop-blur-md pr-1 hc:pr-0">
            {playlistMode ? (
              <div className="pointer-events-none absolute -left-2 top-0 bottom-0 m-auto z-10 h-16 w-16">
                <Avatar
                  className={cn(
                    "h-full w-full border-2 transition-colors",
                    !hasVideo
                      ? "border-muted-foreground/30"
                      : isSelected
                        ? "border-primary"
                        : "border-white/50",
                  )}
                >
                  <AvatarImage
                    src={song.thumbnailURL()}
                    alt="song illustration thumbnail"
                  />
                </Avatar>
                {hasVideo ? (
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center rounded-full bg-primary/60 transition-opacity",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <Check className="h-8 w-8 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                    <VideoOff className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              <IllustrationPopup
                avatarClassName="absolute -left-2 top-0 bottom-0 m-auto song-avatar z-10 w-16 h-16 text-large"
                song={song}
              />
            )}

            {playlistMode ? (
              hasVideo ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => onToggleSelect?.(song)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleSelect?.(song);
                    }
                  }}
                  className={cn(
                    linkClassName,
                    "cursor-pointer",
                    isSelected && "ring-primary ring-2",
                  )}
                >
                  {linkInnerContent}
                </div>
              ) : (
                <div
                  aria-disabled
                  title="No YouTube video — can't add to the playlist"
                  className={cn(
                    linkClassName,
                    "cursor-not-allowed opacity-40 hover:bg-glass/60",
                  )}
                >
                  {linkInnerContent}
                </div>
              )
            ) : externalSearch ? (
              <Link
                to="/import"
                search={{
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  url: song.url()!,
                  sourceId: externalSourceId!,
                  thumbnailURL: song.currentIllustration
                    ? song.thumbnailURL()
                    : undefined,
                }}
                preload={false}
                className={linkClassName}
              >
                {linkInnerContent}
              </Link>
            ) : (
              <Link
                to="/song/$songId"
                params={{ songId: song.id }}
                search={songbookOwner ? { songbook: songbookOwner } : {}}
                preload="intent"
                className={linkClassName}
              >
                {linkInnerContent}
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default SongRow;
