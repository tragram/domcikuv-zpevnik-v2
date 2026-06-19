import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  FilterSettings,
  VocalRangeType,
} from "~/features/SongList/Toolbar/filters/Filters";
import type { SongLanguage } from "~/types/types";

interface FilterSettingsState extends FilterSettings {
  /** Selected songbooks by owner id; resolved against the live DB at read time. */
  selectedSongbookIds: string[];
  setLanguage: (language: SongLanguage) => void;
  toggleSongbook: (songbookId: string) => void;
  setSelectedSongbookIds: (ids: string[]) => void;
  clearSongbooks: () => void;
  setVocalRange: (range: VocalRangeType) => void;
  setHideCapo: (hideCapo: boolean) => void;
  toggleHideCapo: () => void;
  toggleFavorites: () => void;
  toggleShowExternal: () => void;
  resetFilters: () => void;
}

const FILTER_DEFAULTS: FilterSettings & { selectedSongbookIds: string[] } = {
  language: "all",
  vocalRange: "all",
  selectedSongbookIds: [],
  hideCapo: false,
  onlyFavorites: false,
  showExternal: false,
};

export const useFilterSettingsStore = create<FilterSettingsState>()(
  persist(
    (set) => ({
      ...FILTER_DEFAULTS,
      setLanguage: (language) => set({ language }),
      toggleSongbook: (songbookId) =>
        set((state) => ({
          selectedSongbookIds: state.selectedSongbookIds.includes(songbookId)
            ? state.selectedSongbookIds.filter((id) => id !== songbookId)
            : [...state.selectedSongbookIds, songbookId],
        })),
      setSelectedSongbookIds: (ids) => set({ selectedSongbookIds: ids }),
      clearSongbooks: () => set({ selectedSongbookIds: [] }),
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
      version: 1,
      // v0 stored `capo` meaning "allow capo songs" (default true, i.e. unfiltered).
      // v1 renamed it to `hideCapo` (default false) so the button highlights only
      // while actually filtering, matching every other filter control.
      migrate: (persistedState, version) => {
        if (version === 0) {
          const { capo, ...rest } = persistedState as { capo?: boolean } & Record<
            string,
            unknown
          >;
          return { ...rest, hideCapo: capo === false };
        }
        return persistedState as FilterSettingsState;
      },
    },
  ),
);
