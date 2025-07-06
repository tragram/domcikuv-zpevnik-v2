import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  FilterSettings,
  VocalRangeType,
} from "~/features/SongList/Toolbar/filters/Filters";
import { Songbook, SongLanguage } from "~/types/types";

interface FilterSettingsState extends FilterSettings {
  selectedSongbooks: Set<string>;
  setLanguage: (language: SongLanguage) => void;
  addSongbook: (songbook: Songbook) => void;
  removeSongbook: (songbook: Songbook) => void;
  setSelectedSongbooks: (songbooks: Set<Songbook>) => void;
  clearSongbooks: () => void;
  setVocalRange: (range: VocalRangeType) => void;
  setCapo: (capo: boolean) => void;
  toggleCapo: () => void;
  toggleFavorites: () => void;
}

interface FilterStoreProps {
  availableSongbooks: Set<Songbook>;
}

function deleteFromSet<T>(set: Set<T>, value: T) {
  set.delete(value);
  return set;
}

const createFilterSettingsStore = (initProps: FilterStoreProps) =>
  create<FilterSettingsState>()(
    persist(
      (set) => ({
        language: "all",
        vocalRange: "all",
        // selectedSongbooks only stores the users, this might not be optimal
        selectedSongbooks: new Set(
          Array.from(initProps.availableSongbooks).map((s) => s.user)
        ),
        capo: true,
        onlyFavorites: false,
        setLanguage: (language: SongLanguage) => set({ language: language }),
        setSelectedSongbooks: (songbooks: Set<Songbook>) =>
          set({
            selectedSongbooks: new Set(
              Array.from(songbooks).map((s) => s.user)
            ),
          }),
        addSongbook: (songbook: Songbook) =>
          set((state) => ({
            selectedSongbooks: state.selectedSongbooks.add(songbook.user),
          })),
        removeSongbook: (songbook: Songbook) =>
          set((state) => ({
            selectedSongbooks: deleteFromSet(
              state.selectedSongbooks,
              songbook.user
            ),
          })),
        clearSongbooks: () => set({ selectedSongbooks: new Set() }),
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

            // Convert selectedSongbooks array back to Set
            if (
              parsed.state?.selectedSongbooks &&
              Array.isArray(parsed.state.selectedSongbooks)
            ) {
              if (parsed.state.selectedSongbooks.length === 0) {
                parsed.state.selectedSongbooks = new Set(
                  Array.from(initProps.availableSongbooks).map((s) => s.user)
                );
              } else {
                parsed.state.selectedSongbooks = new Set(
                  parsed.state.selectedSongbooks
                );
              }
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
  availableSongbooks: Set<Songbook>;
}) => {
  const [store] = React.useState(() =>
    createFilterSettingsStore({ availableSongbooks })
  );

  return (
    <FilterStoreContext.Provider value={store}>
      {children}
    </FilterStoreContext.Provider>
  );
};
