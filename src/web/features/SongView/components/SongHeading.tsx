import { useLayoutEffect, useRef, useState } from "react";
import { UserProfileData } from "src/worker/api/userProfile";
import { FavoriteButton } from "~/components/FavoriteButton";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import type { LayoutSettings } from "../hooks/viewSettingsStore";
import { SONG_SOURCES_PRETTY } from "src/lib/db/schema/song.schema";
import { Link } from "@tanstack/react-router";

interface SongHeadingProps {
  songData: SongData;
  layoutSettings: LayoutSettings;
  transposeSteps: number;
  user?: UserProfileData;
}

// (Helper function formatChords kept the same...)
function formatChords(data: string) {
  return data.split(/(\d|[#b])/).map((part, index) => {
    if (/\d/.test(part)) return <sub key={index}>{part}</sub>;
    if (/[#b]/.test(part)) return <sup key={index}>{part}</sup>;
    return part;
  });
}
const SongHeading: React.FC<SongHeadingProps> = ({
  songData,
  layoutSettings,
  transposeSteps,
  user,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isWrapped, setIsWrapped] = useState(false);

  useLayoutEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const children = Array.from(parent.children) as HTMLElement[];
        if (children.length < 2) return;

        const [left, right] = children;

        // 1. Temporarily neutralize the elements to measure natural flow
        const originalLeftWidth = left.style.width;
        const originalRightWidth = right.style.width;

        left.style.width = "auto";
        right.style.width = "auto";

        // 2. Perform the measurement
        const wrapped = right.offsetTop > left.offsetTop;

        // 3. Restore immediately
        left.style.width = originalLeftWidth;
        right.style.width = originalRightWidth;

        setIsWrapped(wrapped);
      });
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, [layoutSettings, songData]); // Re-run only if settings/data change

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full justify-between flex-wrap gap-4 text-primary dark:text-white rounded-2xl dark:rounded-none mb-4",
        isWrapped && "justify-center gap-6",
      )}
    >
      <div
        className={cn(
          "flex flex-col flex-grow align-middle song-heading",
          isWrapped ? "text-center" : "justify-start",
        )}
      >
        <h2 className="font-semibold text-wrap uppercase dark:text-foreground select-text">
          {songData.artist}
        </h2>
        <h2 className="font-bold text-wrap  dark:text-white select-text">
          {songData.title}
        </h2>
      </div>
      <div
        className={cn(
          "flex gap-4 md:gap-6 items-center",
          isWrapped ? "w-full justify-around" : "",
        )}
      >
        <div
          className={cn(
            "flex flex-col  dark:text-white/70 ",
            isWrapped ? "w-fit mb-4" : "text-right flex-grow",
          )}
        >
          <h2 className="text-[0.75em] text-nowrap">
            Capo: {(songData.capo - transposeSteps + 12) % 12}
          </h2>
          {songData.externalSource ? ( // external songs won't have range --> safe to replace by import source
            <Link
              className="text-[0.55em] dark:text-white/70"
              to={songData.externalSource.url}
              target="_blank"
            >
              {songData.externalSource &&
                `Imported from ${SONG_SOURCES_PRETTY[songData.externalSource.id]}`}
            </Link>
          ) : (
            <h3 className="text-[0.75em] sub-sup-container">
              {songData.range
                ? formatChords(songData.range.toString(transposeSteps, true))
                : ""}
            </h3>
          )}
        </div>
        {user?.loggedIn && (
          <FavoriteButton
            song={songData}
            iconClassName={cn(
              "size-[2em] stroke-[1.5]",
              isWrapped ? "" : "max-w-14",
            )}
            className="p-0"
          />
        )}
      </div>
    </div>
  );
};

export default SongHeading;
