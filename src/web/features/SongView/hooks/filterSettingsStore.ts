import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FilterSettings,
  VocalRangeType,
} from "~/features/SongList/Toolbar/filters/Filters";
import type { SongLanguage } from "~/types/types";

interface FilterSettingsState extends FilterSettings {
  /** Selected songbook owner id (single-select); resolved against the live DB at read time. */
  selectedSongbookId: string | null;
  setLanguage: (language: SongLanguage) => void;
  /** Select a songbook, or clear it if it's already the active one. */
  toggleSongbook: (songbookId: string) => void;
  /** Idempotently set (or clear) the selected songbook — used to apply a URL param on load. */
  setSelectedSongbook: (songbookId: string | null) => void;
  setVocalRange: (range: VocalRangeType) => void;
  setHideCapo: (hideCapo: boolean) => void;
  toggleHideCapo: () => void;
  toggleFavorites: () => void;
  toggleShowExternal: () => void;
  resetFilters: () => void;
}

const FILTER_DEFAULTS: FilterSettings & { selectedSongbookId: string | null } = {
  language: "all",
  vocalRange: "all",
  selectedSongbookId: null,
  hideCapo: false,
  onlyFavorites: false,
  showExternal: false,
};

export const useFilterSettingsStore = create<FilterSettingsState>()(
  persist(
    (set) => ({
      ...FILTER_DEFAULTS,
      setLanguage: (language) => set({ language }),
      // Single-select: picking a songbook replaces the selection; picking the
      // active one clears it.
      toggleSongbook: (songbookId) =>
        set((state) => ({
          selectedSongbookId:
            state.selectedSongbookId === songbookId ? null : songbookId,
        })),
      setSelectedSongbook: (songbookId) =>
        set({ selectedSongbookId: songbookId }),
      setVocalRange: (range) => set({ vocalRange: range }),
      setHideCapo: (hideCapo) => set({ hideCapo }),
      toggleHideCapo: () => set((state) => ({ hideCapo: !state.hideCapo })),
      toggleFavorites: () =>
        set((state) => ({ onlyFavorites: !state.onlyFavorites })),
      toggleShowExternal: () =>
        set((state) => ({ showExternal: !state.showExternal })),
      resetFilters: () => set(FILTER_DEFAULTS),
    }),
    {
      name: "filter-settings-store",
      version: 2,
      // v0 stored `capo` meaning "allow capo songs" (default true, i.e. unfiltered);
      // v1 renamed it to `hideCapo` (default false) to match other filter controls.
      // v2 replaced multi-select `selectedSongbookIds` with single-select `selectedSongbookId`.
      migrate: (persistedState, version) => {
        let state = persistedState as Record<string, unknown>;
        if (version === 0) {
          const { capo, ...rest } = state as { capo?: boolean } & Record<
            string,
            unknown
          >;
          state = { ...rest, hideCapo: capo === false };
        }
        if (version <= 1) {
          const { selectedSongbookIds, ...rest } = state as {
            selectedSongbookIds?: string[];
          } & Record<string, unknown>;
          state = {
            ...rest,
            selectedSongbookId: selectedSongbookIds?.[0] ?? null,
          };
        }
        return state as FilterSettingsState;
      },
    },
  ),
);
