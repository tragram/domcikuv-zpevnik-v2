import { useRouteContext } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Globe, RefreshCw, Search } from "lucide-react";
import { useRef } from "react";

import useLocalStorageState from "use-local-storage-state";
import { Button } from "~/components/ui/button";
import "~/features/SongList/SongList.css";
import { useScrollDirection } from "~/hooks/use-scroll-direction";
import { SongDB } from "~/types/types";
import { useFilterSettingsStore } from "../SongView/hooks/filterSettingsStore";
import SongRow from "./SongRow";
import Toolbar from "./Toolbar/Toolbar";
import { useFilteredSongs } from "./useFilteredSongs";
import { UserData } from "src/web/hooks/use-user-data";

const SCROLL_OFFSET_KEY = "scrollOffset";

function SongList({
  songDB,
  songDBSyncing,
  userData,
}: {
  songDB: SongDB;
  songDBSyncing: boolean;
  userData: UserData;
}) {
  const [scrollOffset, setScrollOffset] = useLocalStorageState<number>(
    SCROLL_OFFSET_KEY,
    { defaultValue: 0, storageSync: false },
  );

  const {
    songs,
    externalSongs,
    isLoadingExternal,
    triggerExternalSearch,
    hasTriggeredExternalSearch,
    canSearchExternal,
  } = useFilteredSongs(songDB.songs, songDB.languages, userData, songDB.songbooks);

  const { resetFilters } = useFilterSettingsStore();
  const isToolbarVisible = useScrollDirection();
  const favoritesApi = useRouteContext({ from: "/" }).api.favorites;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const virtualizer = useWindowVirtualizer({
    count: songs.length,
    estimateSize: () => 70,
    overscan: 10,
    initialOffset: scrollOffset,
    onChange: (instance) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setScrollOffset(instance.scrollOffset ?? 0);
      }, 200);
    },
  });

  // --- Derived State ---
  const hasInternalResults = songs.length > 0;
  const hasExternalResults = externalSongs.length > 0;

  const showExternalSeparator =
    hasInternalResults &&
    canSearchExternal &&
    hasTriggeredExternalSearch &&
    hasExternalResults;

  const showSearchTrigger = canSearchExternal && !hasTriggeredExternalSearch;

  const showUnifiedEmptyState =
    !hasInternalResults &&
    (!canSearchExternal ||
      (hasTriggeredExternalSearch &&
        !isLoadingExternal &&
        !hasExternalResults));

  // --- Render Helpers ---
  const renderInternalSongs = () => (
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
            transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
          }}
        >
          <SongRow
            song={songs[item.index]}
            maxRange={songDB.maxRange}
            userData={userData}
            favoritesApi={favoritesApi}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="no-scrollbar w-full relative">
      <Toolbar
        isAdmin={!!userData && userData.profile.isAdmin}
        songDB={songDB}
        isVisible={isToolbarVisible}
        // isSyncing removed from Toolbar
      />

      {/* Floating "Updates Available" Pill */}
      {/* {hasPendingUpdates && scrollOffset > 0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in">
          <Button
            onClick={() => {
              setDisplayedSongs(songDB.songs);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-full shadow-lg gap-2"
          >
            <ArrowUp className="w-4 h-4" />
            New updates available
          </Button>
        </div>
      )} */}

      {/* Floating Bottom-Right Sync Bubble */}
      {songDBSyncing && (
        <div className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-background border shadow-lg animate-in fade-in slide-in-from-bottom-4 primary">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      <div className="pt-[72px] sm:pt-20 pb-2">
        {/* SECTION 1: Internal Songs */}
        {hasInternalResults && renderInternalSongs()}

        {/* SECTION 2: External Search Trigger & Results */}
        <div className="container mx-auto max-w-3xl flex flex-col gap-2 pb-8">
          {showExternalSeparator && (
            <div className="my-6 flex items-center gap-4">
              <div className="h-px bg-border flex-1" />
              <div className="flex items-center gap-2 px-4 text-xs font-medium text-primary uppercase tracking-wider whitespace-nowrap">
                <Globe className="w-3 h-3" />
                External Results
              </div>
              <div className="h-px bg-border flex-1" />
            </div>
          )}

          {showSearchTrigger && (
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

          {isLoadingExternal && (
            <div className="flex justify-center w-full py-8">
              <div className="flex flex-col items-center gap-2 animate-pulse text-muted-foreground">
                <Search className="w-6 h-6 animate-bounce" />
                <span className="text-sm">Searching external libraries...</span>
              </div>
            </div>
          )}

          {hasTriggeredExternalSearch &&
            hasExternalResults &&
            externalSongs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                maxRange={undefined}
                userData={userData}
                externalSearch={true}
                favoritesApi={favoritesApi}
              />
            ))}
        </div>

        {/* SECTION 3: Unified Empty State */}
        {showUnifiedEmptyState && (
          <div className="flex flex-col h-full w-full items-center justify-center">
            <div className="text-primary text-center text-xl font-bold sm:text-2xl border bg-muted/20 border-dashed p-8 rounded-lg m-6 w-[80%] max-w-[800px] items-center justify-center leading-[1.7] lg:p-16">
              <p>No songs fulfill all the filters set!</p>
              {hasTriggeredExternalSearch && !hasExternalResults && (
                <p className="text-sm font-normal text-white/80">
                  No results found in external libraries either.
                </p>
              )}
              <Button variant="outline" className="mt-6" onClick={resetFilters}>
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
