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
  toggleFavorites: () => void;
  resetFilters: () => void;
}

const FILTER_DEFAULTS: FilterSettings & { selectedSongbookId: string | null } = {
  language: "all",
  vocalRange: "all",
  selectedSongbookId: null,
  onlyFavorites: false,
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
      toggleFavorites: () =>
        set((state) => ({ onlyFavorites: !state.onlyFavorites })),
      resetFilters: () => set(FILTER_DEFAULTS),
    }),
    {
      name: "filter-settings-store",
      version: 4,
      // v2 replaced multi-select songbooks; v3 removes capo filtering and v4 removes the imported-song toggle.
      migrate: (persistedState, version) => {
        const { capo: _capo, hideCapo: _hideCapo, showExternal: _showExternal, ...rest } =
          persistedState as Record<string, unknown>;
        let state = rest;
        if (version <= 1) {
          const { selectedSongbookIds, ...rest } = state as {
            selectedSongbookIds?: string[];
          } & Record<string, unknown>;
          state = {
            ...rest,
            selectedSongbookId: selectedSongbookIds?.[0] ?? null,
          };
        }
        // Migrated state is a partial snapshot; zustand merges it over defaults.
        return state as unknown as FilterSettingsState;
      },
    },
  ),
);
