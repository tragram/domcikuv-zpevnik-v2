import { IllustrationPrompt } from "~/components/IllustrationPrompt";
import { Button } from "~/components/shadcn-ui/button";
import { SongData } from "~/types/songData";
import { CircleX } from "lucide-react";
import { memo, useEffect, useMemo, useState, useRef } from "react";
import "./SongGallery.css";
import { Link, useLocation } from "@tanstack/react-router";
import { SongDB } from "~/types/types";
import { useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";

const getShuffledArr = (arr: SongData[]) => {
  const newArr = arr.slice();
  for (let i = newArr.length - 1; i > 0; i--) {
    const rand = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[rand]] = [newArr[rand], newArr[i]];
  }
  return newArr;
};

const imageHeight = (normalHeight: number, variability: number) => {
  return Math.round(
    normalHeight * (1 - variability + variability * Math.random())
  );
};

function CardThatHides({ song }: { song: SongData }) {
  const [hidden, setHidden] = useState(false);
  const [showingContent, setShowingContent] = useState(false);
  const onError = () => {
    console.log("Error showing image in gallery!");
    setHidden(true);
  };
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  return (
    <>
      <div className={"w-full h-full relative " + (hidden ? "hidden" : "flex")}>
        <div
          className="background-image flex w-full rounded-lg"
          onError={onError}
          style={{ backgroundImage: `url("${song.illustrationURL()}")` }}
        ></div>
        <div
          className={
            "image-overlay absolute overflow-hidden rounded-lg z-10 border-1 border-glass/30 backdrop-blur-lg bg-primary/30 " +
            ("opacity-" + overlayOpacity)
          }
          onMouseOver={() => setOverlayOpacity(100)}
          onMouseOut={() => setOverlayOpacity(0)}
          onMouseEnter={() => setShowingContent(true)}
          onClick={() => setShowingContent(true)}
        >
          <div className="w-full h-full flex flex-col items-center justify-start pt-4 overflow-hidden ">
            <CircleX
              className="absolute top-4 right-4 w-8 h-8 text-white/80 hover:text-white"
              onClick={() => setOverlayOpacity(0)}
            />
            <h2 className="text-tiny text-white/90 font-bold uppercase text-shadow">
              {song.artist}
            </h2>
            <h2 className="text-white font-bold text-shadow">{song.title}</h2>
            <IllustrationPrompt
              song={song}
              show={showingContent}
              className={"text-white h-32"}
            />
            <Button
              asChild
              className={
                "w-full rounded-t-none bg-primary text-white text-md backdrop-blur-sm hover:bg-background hover:text-primary hover:dark:text-white" +
                (showingContent ? "" : " hidden")
              }
            >
              <Link to={song.url()}>View</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

type SongGalleryProps = {
  songDB: SongDB;
};

// Calculate columns based on window width
const columnData = () => {
  const breakpoints = [550, 1000, 1400, 1800];
  const windowWidth = window.innerWidth;
  let columnNr;
  for (const i of Array(breakpoints.length).keys()) {
    if (windowWidth < breakpoints[i]) {
      columnNr = i + 1;
      break;
    }
  }
  if (!columnNr) {
    columnNr = Math.floor(windowWidth / 450);
  }
  return { columnNr, columnWidth: windowWidth / columnNr };
};

const SongGallery = memo(({ songDB }: SongGalleryProps) => {
  const { columnNr, columnWidth } = columnData();
  const shuffledSongs = useMemo(
    () => getShuffledArr(songDB.songs),
    [songDB.songs]
  );
  const songHeights = useMemo(
    () =>
      shuffledSongs.map(() =>
        imageHeight(Math.min(512, 1.5 * columnWidth), 0.3)
      ),
    [shuffledSongs]
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: shuffledSongs.length,
    estimateSize: (i) => songHeights[i], // Base height + gap
    overscan: 5,
    lanes: columnNr,
  });

  return (
    <div
      className="List"
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: "100%",
        position: "relative",
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.index}
          style={{
            position: "absolute",
            top: 0,
            left: `${virtualRow.lane * columnWidth}px`,
            width: columnWidth,
            height: `${songHeights[virtualRow.index]}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <div className="h-full w-full p-1 md:p-2">
            <CardThatHides song={shuffledSongs[virtualRow.index]} />
          </div>
        </div>
      ))}
    </div>
  );
});

export default SongGallery;
