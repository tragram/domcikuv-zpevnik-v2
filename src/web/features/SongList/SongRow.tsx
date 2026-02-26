import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { memo } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import CircularProgress from "~/components/circular-progress";
import { FavoriteButton } from "~/components/FavoriteButton";
import { IllustrationPopup } from "~/components/IllustrationPopup";
import LanguageFlag from "~/components/LanguageFlag";
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
    <h3 className="song-artist truncate text-sm opacity-50">{artist}</h3>
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
          <h3 className="text-xs opacity-70">{MONTH_NAMES[month - 1]}</h3>
          <h2 className="text-sm opacity-70">{year}</h2>
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
    <h2 className="text-xs opacity-70">Capo</h2>
    <h3 className="text-sm opacity-70">{capo}</h3>
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
        <CircularProgress
          value={songRangeSemitones || maxRange}
          maxValue={maxRange}
        />
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

interface SongbookAvatarsProps {
  songbooks: string[];
  maxAvatars?: number;
  className?: string;
}

// const SongBookAvatars = memo(
//   ({ songbooks, maxAvatars = 3, className = "" }: SongbookAvatarsProps) => {
//     const songbooksWithAvatars = songBooksWAvatars(songbooks).filter(
//       (s) => s.value !== "All"
//     );
//     const displaySongbooks = songbooksWithAvatars.slice(0, maxAvatars);
//     const remainingCount = songbooksWithAvatars.length - maxAvatars;

//     return (
//       <div className={cn("flex items-center justify-end", className)}>
//         <div className="flex w-fit items-center justify-end -space-x-5">
//           {displaySongbooks.map((songbook, index) => (
//             <div
//               key={index}
//               className={cn(
//                 "border-background h-10 w-10 rounded-full border-2 hover:z-10"
//               )}
//             >
//               <Avatar className={"h-full w-full"}>
//                 <AvatarImage
//                   src={songbook.avatar}
//                   alt={songbook.value + " avatar"}
//                 />
//                 <AvatarFallback>{songbook.avatar_fallback}</AvatarFallback>
//               </Avatar>
//             </div>
//           ))}
//           {remainingCount > 0 && (
//             <div className="border-background bg-muted relative flex items-center justify-center rounded-full border-2 hover:z-10">
//               <Avatar className={""}>
//                 <AvatarFallback>+{remainingCount}</AvatarFallback>
//               </Avatar>
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   }
// );

interface SongRowProps {
  song: SongData;
  maxRange?: number | undefined;
  user: UserProfileData;
  externalSearch?: boolean;
}

const SongRow = memo(
  ({ song, maxRange, user, externalSearch = false }: SongRowProps) => {
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
      return;
    }
    return (
      <div className="song-row-wrapper container mx-auto flex h-[70px] max-w-3xl items-center px-2 sm:px-4">
        <div
          className="song-row-bg-image flex h-14 w-full min-w-72 rounded-full"
          style={{ backgroundImage: `url(${song.thumbnailURL()})` }}
        >
          <div className="song-row-bg-image row-text-shadow relative flex h-full w-full items-center rounded-full p-1 shadow-black backdrop-blur-md">
            <IllustrationPopup
              avatarClassName="absolute -left-0 top-0 bottom-0 m-auto song-avatar z-10 w-16 h-16 text-large"
              song={song}
            />
            <Link
              to={externalSearch ? "/import" : song.url()}
              search={
                externalSearch
                  ? {
                      id: song.id,
                      title: song.title,
                      artist: song.artist,
                      url: song.url()!,
                      // TS complains but it should be OK...?
                      sourceId: externalSourceId!,
                      thumbnailURL: song.thumbnailURL(),
                    }
                  : {}
              }
              preload={externalSearch ? false : "intent"}
              className="song-row bg-glass/60 hover:bg-glass/90 relative flex h-12 w-full rounded-full backdrop-blur-lg"
            >
              <div className="relative flex min-w-[72px] content-center justify-center rounded-l-full" />

              <SongInfo
                title={song.title}
                artist={song.artist}
                className="flex-auto"
              />

              {/* <SongBookAvatars songbooks={song.songbooks} className="hidden sm:flex ml-2" /> */}
              {user.loggedIn && !externalSearch && (
                <FavoriteButton
                  song={song}
                  className="hidden shrink-0 basis-1/12 xs:flex"
                />
              )}

              <DateDisplay
                month={song.createdAt.getMonth() + 1}
                year={song.createdAt.getFullYear()}
                className="xsm:flex hidden shrink-0 basis-[2/12] md:basis-1/12"
              />

              <CapoDisplay
                capo={song.capo}
                className="hidden shrink-0 basis-1/12 lg:flex"
              />

              <VocalRangeIndicator
                songRangeSemitones={song.range?.semitones}
                maxRange={maxRange}
                className="hidden shrink-0 basis-1/12 md:flex"
              />

              <div className="flex min-w-10 shrink-0 basis-[5%] items-center justify-end p-2">
                {!externalSearch && <LanguageFlag language={song.language} />}
              </div>
            </Link>
          </div>
        </div>
      </div>
    );
  },
);

export default SongRow;
