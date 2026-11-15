import { useLayoutEffect, useRef, useState } from "react";

import { FavoriteButton } from "~/components/FavoriteButton";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import type { LayoutSettings } from "../hooks/viewSettingsStore";
import { SONG_SOURCES_PRETTY } from "src/lib/contracts/song-sources";
import { Link } from "@tanstack/react-router";
import type { UserData } from "~/hooks/use-user-data";
import { SongVersionBadge } from "./SongVersionBadge";
import type { VersionSelection } from "../utils/versionDetails";
import type { FeedStatus } from "../hooks/useSessionSync";
import type { SongTranspose } from "../hooks/songTransposeMath";
import CapoControl from "../settings/CapoSettings";

interface SongHeadingProps {
  songData: SongData;
  layoutSettings: LayoutSettings;
  // The viewer's resolved key/capo. Omitted in read-only contexts (the editor
  // preview): the heading then falls back to the song's own key/capo and the
  // capo stepper is inert.
  transpose?: SongTranspose;
  versionSelection?: VersionSelection;
  userData?: UserData;
  feedStatus?: FeedStatus;
}

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
  transpose,
  versionSelection,
  userData,
  feedStatus,
}) => {
  // Read-only contexts (editor preview) pass no transpose: fall back to the
  // song's own key/capo and leave the capo stepper inert.
  const transposeSteps = transpose?.transposeSteps ?? 0;
  const capo = transpose?.capo ?? songData.capo ?? 0;
  const originalCapo = transpose?.originalCapo ?? songData.capo ?? 0;
  const setCapo = transpose?.setCapo;
  const songbookPersonalization = transpose?.songbookPersonalization;
  const canEditCapo = !!userData && !!setCapo;
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
        <h2 className="text-[1.125em] font-bold text-wrap dark:text-white select-text">
          {songData.title}
        </h2>
      </div>
      <div
        className={cn(
          "flex flex-col items-end justify-between gap-y-[0.15em]",
          isWrapped ? "w-full items-center" : "self-stretch",
        )}
      >
        <div className="flex items-center gap-4 md:gap-6">
          <div
            className={cn(
              "flex shrink-0 flex-col justify-between items-end gap-y-[0.15em] text-right dark:text-white/70",
              isWrapped && "gap-1",
            )}
          >
            {(canEditCapo || capo > 0) && (
              <CapoControl
                capo={capo}
                setCapo={setCapo ?? (() => {})}
                originalCapo={originalCapo}
                editable={canEditCapo}
                className="text-[0.6em] leading-tight text-nowrap"
              />
            )}
            {songData.externalSource ? (
              <Link
                className="text-[0.55em] leading-tight dark:text-white/70"
                to={songData.externalSource.url}
                target="_blank"
              >
                {`Imported from ${SONG_SOURCES_PRETTY[songData.externalSource.sourceId]}`}
              </Link>
            ) : songData.range && (
              <h3 className="shrink-0 whitespace-nowrap text-[0.6em] leading-[1.8] sub-sup-container">
                {formatChords(songData.range.toString(transposeSteps, true))}
              </h3>
            )}

          </div>
          {userData && (
            <FavoriteButton
              song={songData}
              userId={userData.profile.id}
              personalization={songbookPersonalization}
              iconClassName="size-[2em] stroke-[1.5] max-w-14"
              className="self-center p-0"
            />
          )}

        </div>
        <SongVersionBadge
          key={`${songData.id}:${songData.versionId}`}
          songData={songData}
          userData={userData}
          selection={versionSelection}
          feedStatus={feedStatus}
        />
      </div>
    </div>
  );
};

export default SongHeading;
