import { useState } from "react";
import { SongDB } from "~/types/types";
import useLocalStorageState from "use-local-storage-state";
import "~/features/SongList/SongList.css";
import SongRow from "./SongRow";
import Toolbar from "./Toolbar/Toolbar";
import { useFilteredSongs } from "./useFilteredSongs";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { UserProfileData } from "src/worker/api/userProfile";
import { useFilterSettingsStore } from "../SongView/hooks/filterSettingsStore";
import { Button } from "~/components/ui/button";

const SCROLL_OFFSET_KEY = "scrollOffset";

function SongList({ songDB, user }: { songDB: SongDB; user: UserProfileData }) {
  const { songs } = useFilteredSongs(
    songDB.songs,
    songDB.languages,
    user,
    songDB.songbooks
  );
  const { resetFilters } = useFilterSettingsStore();
  const [showToolbar, setShowToolbar] = useState(true);
  const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(
    SCROLL_OFFSET_KEY,
    { defaultValue: 0, storageSync: false }
  );

  const virtualizer = useWindowVirtualizer({
    count: songs.length,
    estimateSize: () => 70,
    overscan: 10,
    initialOffset: scrollOffset,
    onChange: (instance) => {
      setScrollOffset(instance.scrollOffset ?? 0);

      const isAtTop = (instance.scrollOffset ?? 0) === 0;
      if (instance.scrollDirection === "backward" || isAtTop) {
        setShowToolbar(true);
      } else if (instance.scrollDirection === "forward") {
        setShowToolbar(false);
      }
    },
  });

  return (
    <div className="no-scrollbar w-full">
      <Toolbar
        songDB={songDB}
        showToolbar={showToolbar}
        scrollOffset={scrollOffset}
        fakeScroll={true}
      />
      {songs.length > 0 ? (
        <div className="List pt-[72px] sm:pt-20 pb-2">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((item) => (
              <div
                key={songs[item.index].id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${item.size}px`,
                  transform: `translateY(${
                    item.start - virtualizer.options.scrollMargin
                  }px)`,
                }}
              >
                <SongRow
                  song={songs[item.index]}
                  maxRange={songDB.maxRange}
                  user={user}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-[50dvh] text-primary flex flex-col h-full w-full items-center justify-center text-center text-xl font-bold sm:text-2xl gap-4">
          <p>No songs fulfill all the filters set!</p>
          <Button variant={"outline"} onClick={resetFilters}>
            Reset all filters
          </Button>
        </div>
      )}
    </div>
  );
}

export default SongList;
