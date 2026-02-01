import { useRef, useState } from "react";
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
import { cn } from "~/lib/utils";

const SCROLL_OFFSET_KEY = "scrollOffset";

function SongList({ songDB, user }: { songDB: SongDB; user: UserProfileData }) {
  const { songs, externalSongs, isLoadingExternal, shouldSearchExternal } =
    useFilteredSongs(
      songDB.songs,
      songDB.languages,
      user,
      songDB.songbooks,
    );
  const { resetFilters } = useFilterSettingsStore();
  const [showToolbar, setShowToolbar] = useState(true);
  const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(
    SCROLL_OFFSET_KEY,
    { defaultValue: 0, storageSync: false },
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const virtualizer = useWindowVirtualizer({
    count: songs.length,
    estimateSize: () => 70,
    overscan: 10,
    initialOffset: scrollOffset,
    onChange: (instance) => {
      const isAtTop = (instance.scrollOffset ?? 0) === 0;
      if (instance.scrollDirection === "backward" || isAtTop) {
        setShowToolbar(true);
      } else if (instance.scrollDirection === "forward") {
        setShowToolbar(false);
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        setScrollOffset(instance.scrollOffset ?? 0);
      }, 200);
    },
  });

  const hasInternalResults = songs.length > 0;
  const hasExternalResults = externalSongs.length > 0;
  
  // Logic: Show external section if we have results OR if we are currently loading them.
  // We do NOT show it if we are just "ready to search" but finished with 0 results (that falls to Empty State).
  const showExternalSection = hasExternalResults || isLoadingExternal;

  return (
    <div className="no-scrollbar w-full">
      <Toolbar
        songDB={songDB}
        showToolbar={showToolbar}
        scrollOffset={scrollOffset}
        fakeScroll={true}
      />

      <div className="pt-[72px] sm:pt-20 pb-2">
        {/* SECTION 1: Internal Songs */}
        {hasInternalResults && (
          <div
            className="List"
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
        )}

        {/* Separator: Only if we have BOTH internal AND (external results OR loading) */}
        {hasInternalResults && showExternalSection && (
          <div className="container mx-auto max-w-3xl my-6 flex items-center gap-4">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs font-medium text-muted-foreground uppercase">
              External Results
            </span>
            <div className="h-px bg-border flex-1" />
          </div>
        )}

        {/* SECTION 2: External Results Container */}
        {showExternalSection && (
          <div className="container mx-auto max-w-3xl flex flex-col gap-2">
            {/* Context Message */}
            {!hasInternalResults && !isLoadingExternal && hasExternalResults && (
              <div className="text-sm text-muted-foreground p-4 text-center">
                No exact local matches found. Showing results from the web:
              </div>
            )}

            {/* List */}
            {hasExternalResults &&
              externalSongs.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  maxRange={undefined}
                  user={user}
                />
              ))}

            {/* Loading Spinner */}
            {isLoadingExternal && (
              <div
                className={cn(
                  "flex justify-center w-full py-8",
                  // Reduce padding if we already have content above
                  hasExternalResults || hasInternalResults ? "py-4" : "pt-32",
                )}
              >
                <div className="flex flex-col items-center gap-2 animate-pulse text-muted-foreground">
                  <span>Searching external libraries...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: Empty State */}
        {/* Render if: No Internal AND No External AND Not Loading */}
        {!hasInternalResults && !hasExternalResults && !isLoadingExternal && (
            <div className="pt-[20vh] text-primary flex flex-col h-full w-full items-center justify-center text-center text-xl font-bold sm:text-2xl gap-4">
              <p>No songs fulfill all the filters set!</p>
              <Button variant={"outline"} onClick={resetFilters}>
                Reset all filters
              </Button>
            </div>
          )}
      </div>
    </div>
  );
}

export default SongList;