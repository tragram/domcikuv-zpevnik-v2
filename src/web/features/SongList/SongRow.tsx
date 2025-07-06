import { useMutation } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { IllustrationPopup } from "~/components/IllustrationPopup";
import LanguageFlag from "~/components/LanguageFlag";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import CircularProgress from "~/components/circular-progress";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { UserData } from "~/types/types";

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
        className
      )}
    >
      {month && year && (
        <>
          <h3 className="text-xs opacity-70">{MONTH_NAMES[month - 1]}</h3>
          <h2 className="text-sm opacity-70">{year}</h2>
        </>
      )}
    </div>
  )
);

interface VocalRangeIndicatorProps {
  songRangeSemitones: number | undefined;
  maxRange: number;
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
      className
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
    const innerHTML = songRangeSemitones ? (
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
  }
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
interface FavoriteButtonProps {
  songId: string;
  userData: UserData;
  className?: string;
}

const FavoriteButton = ({
  songId,
  userData,
  className = "",
}: FavoriteButtonProps) => {
  // TODO: add "offline" message
  const [isFavorite, setIsFavorite] = useState(userData.favorites.has(songId));
  const routeApi = getRouteApi("/");
  const context = routeApi.useRouteContext()

  // Mutation for adding favorite
  const addFavoriteMutation = useMutation({
    mutationFn: () => context.api.favorites.$post({ json: { songId } }),
    onMutate: async () => {
      setIsFavorite(true);
    },
    onError: (error, variables, context) => {
      setIsFavorite(false);
      toast.error("Failed to add favorite");
    },
  });

  // Mutation for removing favorite
  const removeFavoriteMutation = useMutation({
    mutationFn: () => context.api.favorites.$delete({ json: { songId } }),
    onMutate: async () => {
      setIsFavorite(false);
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      setIsFavorite(true);
      toast.error("Failed to remove favorite");
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isFavorite) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  const isLoading =
    addFavoriteMutation.isPending || removeFavoriteMutation.isPending;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "favorite-button flex items-center justify-center p-2 transition-transform hover:scale-110",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100",
        className
      )}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn(
          "h-6 w-6 transition-colors",
          isLoading && "animate-pulse",
          isFavorite
            ? "fill-primary text-primary"
            : "hover:text-primary text-white/70"
        )}
      />
    </button>
  );
};

interface SongRowProps {
  song: SongData;
  maxRange: number;
  userData: UserData;
}

const SongRow = memo(({ song, maxRange, userData }: SongRowProps) => {
  song = SongData.fromJSON(song);
  if (!song) {
    console.error("Invalid song provided to SongRow");
    return (
      <div className="text-foreground container mx-auto flex h-[70px] max-w-3xl items-center bg-white px-2 sm:px-4">
        Invalid song
      </div>
    );
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
            to={song.url()}
            className="song-row bg-glass/60 hover:bg-glass/90 relative flex h-12 w-full rounded-full backdrop-blur-lg"
          >
            <div className="relative flex min-w-[72px] content-center justify-center rounded-l-full" />

            <SongInfo
              title={song.title}
              artist={song.artist}
              className="flex-auto"
            />

            {/* <SongBookAvatars songbooks={song.songbooks} className="hidden sm:flex ml-2" /> */}
            {userData.loggedIn && (
              <FavoriteButton
                songId={song.id}
                userData={userData}
                className="hidden shrink-0 basis-1/12 xs:flex"
              />
            )}

            <DateDisplay
              month={song.dateAdded?.month}
              year={song.dateAdded?.year}
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
              <LanguageFlag language={song.language} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
});

export default SongRow;
