import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  CheckCheck,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  X,
  Youtube,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import useLocalStorageState from "use-local-storage-state";
import { OfflineIndicator } from "~/components/OfflineIndicator";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import "~/features/SongList/SongList.css";
import { useIsOnline } from "~/hooks/use-is-online";
import { usePullToRefresh } from "~/hooks/use-pull-to-refresh";
import { refreshSongDB } from "~/hooks/use-songDB";
import { useScrollDirection } from "~/hooks/use-scroll-direction";
import { UserData } from "~/hooks/use-user-data";
import { cn } from "~/lib/utils";
import { SongData } from "~/types/songData";
import { SongDB } from "~/types/types";
import { useFilterSettingsStore } from "../SongView/hooks/filterSettingsStore";
import SongRow from "./SongRow";
import Toolbar from "./Toolbar/Toolbar";
import { useDisplayedSongs } from "./useDisplayedSongs";
import { useExternalSearch } from "./useExternalSearch";
import { useYoutubeExport } from "./useYoutubeExport";
import { YOUTUBE_PLAYLIST_MAX } from "src/lib/youtube";

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

  const { songs, bestLocalScore, foreignSongbookOwner } = useDisplayedSongs(
    songDB,
    userData,
  );
  const {
    externalSongs,
    isLoadingExternal,
    triggerExternalSearch,
    hasTriggeredExternalSearch,
    canSearchExternal,
  } = useExternalSearch(userData, bestLocalScore);

  const { resetFilters } = useFilterSettingsStore();
  const isToolbarVisible = useScrollDirection();
  const isOnline = useIsOnline();

  // Manual re-sync of the song DB (pull-to-refresh on touch, toolbar button on
  // desktop). Feedback while it runs comes from the existing sync bubble, which
  // reacts to the queries' isFetching.
  const queryClient = useQueryClient();
  const refreshSongs = useCallback(
    () => refreshSongDB(queryClient),
    [queryClient],
  );
  const { pullDistance, isReady } = usePullToRefresh(refreshSongs, isOnline);

  // --- Playlist mode ---
  // When active, rows show a checkbox and toggle selection instead of opening.
  const [playlistMode, setPlaylistMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((song: SongData) => {
    // Only songs with a video can be in the playlist; ignore the rest.
    if (!song.youtubeId) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(song.id)) next.delete(song.id);
      else next.add(song.id);
      return next;
    });
  }, []);

  const exitPlaylistMode = useCallback(() => {
    setPlaylistMode(false);
    setSelectedIds(new Set());
  }, []);

  const togglePlaylistMode = useCallback(() => {
    setPlaylistMode((on) => !on);
    setSelectedIds(new Set());
  }, []);

  // Only songs with a YouTube video can be selected / exported.
  const selectableSongs = useMemo(
    () => songs.filter((s) => s.youtubeId),
    [songs],
  );

  const allSelected =
    selectableSongs.length > 0 &&
    selectableSongs.every((s) => selectedIds.has(s.id));

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(
      allSelected ? new Set() : new Set(selectableSongs.map((s) => s.id)),
    );
  }, [allSelected, selectableSongs]);

  const selectedVideoIds = useMemo(
    () =>
      selectableSongs
        .filter((s) => selectedIds.has(s.id))
        .map((s) => s.youtubeId!),
    [selectableSongs, selectedIds],
  );

  const { isExporting, exportPlaylist: runExport } = useYoutubeExport();
  const [playlistName, setPlaylistName] = useState("");
  const defaultPlaylistName = `Domčíkův Zpěvník – ${new Date().toISOString().slice(0, 10)}`;
  const exportPlaylist = useCallback(
    () => runExport(selectedVideoIds, { title: playlistName.trim() || undefined }),
    [runExport, selectedVideoIds, playlistName],
  );

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
            songbookOwner={foreignSongbookOwner}
            playlistMode={playlistMode}
            isSelected={selectedIds.has(songs[item.index].id)}
            onToggleSelect={toggleSelect}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="no-scrollbar w-full relative">
      <OfflineIndicator />
      <Toolbar
        isAdmin={!!userData && userData.profile.isAdmin}
        userData={userData}
        songDB={songDB}
        isVisible={isToolbarVisible}
        playlistMode={playlistMode}
        onTogglePlaylistMode={togglePlaylistMode}
        onRefresh={refreshSongs}
        isSyncing={songDBSyncing}
      />

      {/* Pull-to-refresh indicator: tracks the drag; once released, the sync
          bubble below takes over as the "refreshing" feedback. */}
      {pullDistance > 0 && (
        <div
          className="pointer-events-none fixed left-1/2 top-0 z-50"
          style={{ transform: `translate(-50%, ${pullDistance - 48}px)` }}
        >
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full bg-background border shadow-lg",
              isReady ? "text-primary" : "text-muted-foreground",
            )}
          >
            <RefreshCw
              className="h-5 w-5"
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        </div>
      )}

      {/* Floating Bottom-Right Sync Bubble */}
      {songDBSyncing && (
        <div className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-background border shadow-lg animate-in fade-in slide-in-from-bottom-4 primary">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {/* Playlist mode: selection / export action bar */}
      {playlistMode && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 shadow-lg backdrop-blur animate-in slide-in-from-bottom-4">
          <div className="container mx-auto flex max-w-3xl items-center gap-2 px-3 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={exitPlaylistMode}
              aria-label="Exit playlist mode"
            >
              <X className="h-5 w-5" />
            </Button>
            {selectableSongs.length === 0 ? (
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                No songs with a video
              </span>
            ) : (
              <Input
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder={defaultPlaylistName}
                maxLength={150}
                aria-label="Playlist name"
                className="h-9 flex-1"
              />
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-2"
              disabled={selectableSongs.length === 0}
              onClick={toggleSelectAll}
            >
              <CheckCheck className="h-4 w-4" />
              {allSelected ? "None" : "All"}
            </Button>
            <Button
              size="sm"
              className="gap-2"
              disabled={selectedVideoIds.length === 0 || isExporting}
              onClick={exportPlaylist}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Youtube className="h-4 w-4" />
              )}
              Export ({Math.min(selectedVideoIds.length, YOUTUBE_PLAYLIST_MAX)})
            </Button>
          </div>
        </div>
      )}

      <div className={cn("pt-[72px] sm:pt-20 pb-2", playlistMode && "pb-24")}>
        {/* SECTION 1: Internal Songs */}
        {hasInternalResults && renderInternalSongs()}

        {/* SECTION 2: External Search Trigger & Results */}
        <div className={cn("container mx-auto max-w-3xl flex flex-col gap-2 pb-2", !isOnline && "pb-11")}>
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
