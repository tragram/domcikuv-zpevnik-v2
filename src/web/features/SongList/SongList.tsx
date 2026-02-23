import { useRef } from "react";
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
import { Globe, Search } from "lucide-react";
import { useScrollDirection } from "~/hooks/use-scroll-direction";

const SCROLL_OFFSET_KEY = "scrollOffset";

function SongList({ songDB, user }: { songDB: SongDB; user: UserProfileData }) {
  const {
    songs,
    externalSongs,
    isLoadingExternal,
    triggerExternalSearch,
    hasTriggeredExternalSearch,
    canSearchExternal,
  } = useFilteredSongs(songDB.songs, songDB.languages, user, songDB.songbooks);

  const { resetFilters } = useFilterSettingsStore();

  // Use our new hook!
  const isToolbarVisible = useScrollDirection();

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
      // We only use this now to save scroll position for when they return to the page
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

  return (
    <div className="no-scrollbar w-full">
      <Toolbar songDB={songDB} isVisible={isToolbarVisible} />

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

        {/* SECTION 2: External Search Trigger & Results */}
        <div className="container mx-auto max-w-3xl flex flex-col gap-2 pb-8">
          {/* Separator if we have mixed content */}
          {hasInternalResults &&
            canSearchExternal &&
            hasTriggeredExternalSearch &&
            hasExternalResults && (
              <div className="my-6 flex items-center gap-4">
                <div className="h-px bg-border flex-1" />
                <div className="flex items-center gap-2 px-4 text-xs font-medium text-primary uppercase tracking-wider whitespace-nowrap">
                  <Globe className="w-3 h-3" />
                  External Results
                </div>
                <div className="h-px bg-border flex-1" />
              </div>
            )}

          {/* Trigger Button: Show if we CAN search but HAVEN'T triggered it yet */}
          {canSearchExternal && !hasTriggeredExternalSearch && (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              {!hasInternalResults && (
                <p className="text-muted-foreground text-sm">
                  No local songs found.
                </p>
              )}
              <Button
                variant="secondary"
                onClick={triggerExternalSearch}
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                Search Online Services
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoadingExternal && (
            <div className="flex justify-center w-full py-8">
              <div className="flex flex-col items-center gap-2 animate-pulse text-muted-foreground">
                <Search className="w-6 h-6 animate-bounce" />
                <span className="text-sm">Searching external libraries...</span>
              </div>
            </div>
          )}

          {/* Results List */}
          {hasTriggeredExternalSearch &&
            hasExternalResults &&
            externalSongs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                maxRange={undefined}
                user={user}
                externalSearch={true}
              />
            ))}
        </div>

        {/* SECTION 3: Unified Empty State */}
        {/* Show when: No internal results AND (cannot search external OR already searched with no results) */}
        {!hasInternalResults &&
          (!canSearchExternal ||
            (hasTriggeredExternalSearch &&
              !isLoadingExternal &&
              !hasExternalResults)) && (
            <div className="flex flex-col h-full w-full items-center justify-center">
              <div className="text-primary text-center text-xl font-bold sm:text-2xl border bg-muted/20 border-dashed p-8 rounded-lg m-6 w-[80%] max-w-[800px] items-center justify-center leading-[1.7] lg:p-16">
                <p>No songs fulfill all the filters set!</p>
                {hasTriggeredExternalSearch && !hasExternalResults && (
                  <p className="text-sm font-normal text-white/80">
                    No results found in external libraries either.
                  </p>
                )}
                <Button
                  variant={"outline"}
                  className="mt-6"
                  onClick={resetFilters}
                >
                  Reset all filters
                </Button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default SongList;
