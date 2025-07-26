import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  FilterSettings,
  VocalRangeType,
} from "~/features/SongList/Toolbar/filters/Filters";
import { Songbook } from "~/services/songs";
import { SongLanguage } from "~/types/types";

interface FilterSettingsState extends FilterSettings {
  selectedSongbooks: Songbook[];
  setLanguage: (language: SongLanguage) => void;
  addSongbook: (songbook: Songbook) => void;
  removeSongbook: (songbook: Songbook) => void;
  setSelectedSongbooks: (songbooks: Songbook[]) => void;
  clearSongbooks: () => void;
  setVocalRange: (range: VocalRangeType) => void;
  setCapo: (capo: boolean) => void;
  toggleCapo: () => void;
  toggleFavorites: () => void;
}

interface FilterStoreProps {
  availableSongbooks: Songbook[];
}
const safeAddSongbook = (songbooks: Songbook[], songbook: Songbook) => {
  if (songbooks.map((s) => s.name).includes(songbook.name)) {
    return songbooks;
  }
  songbooks.push(songbook);
  return songbooks;
};

const createFilterSettingsStore = (initProps: FilterStoreProps) =>
  create<FilterSettingsState>()(
    persist(
      (set) => ({
        language: "all",
        vocalRange: "all",
        selectedSongbooks: initProps.availableSongbooks,
        capo: true,
        onlyFavorites: false,
        setLanguage: (language: SongLanguage) => set({ language: language }),
        setSelectedSongbooks: (songbooks: Songbook[]) =>
          set({
            selectedSongbooks: songbooks,
          }),
        addSongbook: (songbook: Songbook) =>
          set((state) => ({
            selectedSongbooks: safeAddSongbook(
              state.selectedSongbooks,
              songbook
            ),
          })),
        removeSongbook: (deletedSongbook: Songbook) =>
          set((state) => ({
            selectedSongbooks: state.selectedSongbooks.filter(
              (s) => s.name != deletedSongbook.name
            ),
          })),
        clearSongbooks: () => set({ selectedSongbooks: [] }),
        setVocalRange: (range: VocalRangeType) => set({ vocalRange: range }),
        setCapo: (capo: boolean) => set({ capo: capo }),
        toggleCapo: () => set((state) => ({ capo: !state.capo })),
        toggleFavorites: () =>
          set((state) => ({ onlyFavorites: !state.onlyFavorites })),
      }),
      {
        name: "filter-settings-store",
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const parsed = JSON.parse(str);

            // ensure we do not have selected songbooks that are not available anymore
            if (parsed.state?.selectedSongbooks) {
              const availableSongbookNames = new Set(
                initProps.availableSongbooks.map((s) => s.name)
              );
              parsed.state.selectedSongbooks =
                parsed.state.selectedSongbooks.filter((s: Songbook) =>
                  availableSongbookNames.has(s.name)
                );
            }
            return parsed;
          },
          setItem: (name, value) => {
            // Convert selectedSongbooks Set to array for storage
            const toStore = {
              ...value,
              state: {
                ...value.state,
                selectedSongbooks: Array.from(
                  value.state.selectedSongbooks || []
                ),
              },
            };
            localStorage.setItem(name, JSON.stringify(toStore));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    )
  );

const FilterStoreContext = React.createContext<ReturnType<
  typeof createFilterSettingsStore
> | null>(null);

export const useFilterSettingsStore = () => {
  const store = React.useContext(FilterStoreContext);
  if (!store) {
    throw new Error(
      "useFilterSettingsStore must be used within FilterStoreProvider"
    );
  }
  return store();
};

export const FilterStoreProvider = ({
  children,
  availableSongbooks,
}: {
  children: React.ReactNode;
  availableSongbooks: Songbook[];
}) => {
  const [store] = React.useState(() =>
    createFilterSettingsStore({
      availableSongbooks: availableSongbooks,
    })
  );

  return (
    <FilterStoreContext.Provider value={store}>
      {children}
    </FilterStoreContext.Provider>
  );
};
