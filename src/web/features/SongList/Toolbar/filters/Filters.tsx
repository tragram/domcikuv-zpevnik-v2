import { getRouteApi } from "@tanstack/react-router";
import { Filter, Handshake, Heart } from "lucide-react";
import { JSX } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useMediaQuery } from 'usehooks-ts'
import type { LanguageCount, SongLanguage } from "~/types/types";
import { LanguageFilter, LanguageFilterDropdownSection } from "./LanguageFilter";
import { SongBookFilter, SongBookFilterDropdownSection } from "./SongbookFilter";
import { VocalRangeDropdownSection, VocalRangeFilter } from "./VocalRangeFilter";

type VocalRangeType = "all" | [number, number];

interface FilterSettings {
  language: SongLanguage;
  vocalRange: VocalRangeType;
  capo: boolean;
  onlyFavorites: boolean;
  songbook: string;
}

interface FilterProps {
  languages: LanguageCount;
  maxRange: number;
  songbooks: string[];
}

interface FilterButtonsProps extends FilterProps {
  iconOnly: boolean;
  userFavorites?: string[];
}

interface FilterSettingsState extends FilterSettings {
  setLanguage: (language: SongLanguage) => void;
  setSongbook: (songbook: string) => void;
  setVocalRange: (range: VocalRangeType) => void;
  setCapo: (capo: boolean) => void;
  toggleCapo: () => void;
  toggleFavorites: () => void;
}

export const useFilterSettingsStore = create<FilterSettingsState>()(
  persist(
    (set) => ({
      language: "all",
      vocalRange: "all",
      songbook: "All",
      capo: true,
      onlyFavorites: false,
      setLanguage: (language: SongLanguage) => set({ language: language }),
      setSongbook: (songbook: string) => set({ songbook: songbook }),
      setVocalRange: (range: VocalRangeType) => set({ vocalRange: range }),
      setCapo: (capo: boolean) => set({ capo: capo }),
      toggleCapo: () => set((state) => ({ capo: !state.capo })),
      toggleFavorites: () => set((state) => ({ onlyFavorites: !state.onlyFavorites })),
    }),
    {
      name: "filter-settings-store",
    },
  ),
);

const FilterButtons = ({
  languages,
  maxRange,
  iconOnly,
  songbooks,
}: FilterButtonsProps): JSX.Element => {
  const {
    language,
    songbook,
    vocalRange,
    capo,
    onlyFavorites,
    setLanguage,
    setSongbook,
    setVocalRange,
    toggleCapo,
    toggleFavorites,
  } = useFilterSettingsStore();
  const routeApi = getRouteApi("/");
  const { userData } = routeApi.useLoaderData();
  return (
    <div className="outline-primary dark:outline-primary/30 flex rounded-full outline-2">
      <LanguageFilter
        languages={languages}
        selectedLanguage={language}
        setSelectedLanguage={setLanguage}
        iconOnly={iconOnly}
      />
      <SongBookFilter
        songbooks={songbooks}
        selectedSongbook={songbook}
        setSelectedSongbook={setSongbook}
        iconOnly={iconOnly}
      />
      <Button
        variant="circular"
        isActive={capo}
        className="rounded-none font-bold shadow-none outline-0"
        onClick={toggleCapo}
      >
        <Handshake />
        {!iconOnly && "Capo"}
      </Button>
      {userData.loggedIn && (
        <Button
          variant="circular"
          isActive={onlyFavorites}
          className="rounded-none font-bold shadow-none outline-0"
          onClick={toggleFavorites}
        >
          <Heart />
          {!iconOnly && "Favorites only"}
        </Button>
      )}
      <VocalRangeFilter
        maxRange={maxRange}
        vocalRangeFilter={vocalRange}
        setVocalRangeFilter={setVocalRange}
        iconOnly={iconOnly}
      />
    </div>
  );
};

const Filtering = ({ languages, maxRange, songbooks }: FilterProps): JSX.Element => {
  const {
    language,
    songbook,
    vocalRange,
    capo,
    onlyFavorites,
    setLanguage,
    setSongbook,
    setVocalRange,
    toggleCapo,
    toggleFavorites,
  } = useFilterSettingsStore();
  const routeApi = getRouteApi("/");
  const { userData } = routeApi.useLoaderData();
  const isLargeScreen = useMediaQuery("only screen and (min-width : 1000px)");

  const isFilterInactive =
    language === "all" &&
    (vocalRange === "all" ||
      (Array.isArray(vocalRange) && vocalRange[0] === 0 && vocalRange[1] === maxRange)) &&
    capo;

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:flex">
        <FilterButtons
          languages={languages}
          songbooks={songbooks}
          maxRange={maxRange}
          iconOnly={isLargeScreen}
        />
      </div>

      {/* Mobile View */}
      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular" isActive={!isFilterInactive}>
              <Filter />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            aria-label="Filtering"
            className="dropdown-scroll no-scrollbar max-h-[80dvh] w-52 overflow-y-scroll"
            sideOffset={15}
          >
            {userData && (
              <DropdownMenuCheckboxItem
                onClick={toggleFavorites}
                onSelect={(e) => e.preventDefault()}
                checked={onlyFavorites}
              >
                Show only favorites
              </DropdownMenuCheckboxItem>
            )}
            <DropdownMenuCheckboxItem
              onClick={toggleCapo}
              onSelect={(e) => e.preventDefault()}
              checked={capo}
            >
              Allow capo
            </DropdownMenuCheckboxItem>

            {VocalRangeDropdownSection(maxRange, vocalRange, setVocalRange)}
            {LanguageFilterDropdownSection(languages, language, setLanguage)}
            {SongBookFilterDropdownSection(songbooks, songbook, setSongbook)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default Filtering;
