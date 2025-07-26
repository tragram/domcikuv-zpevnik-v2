import { getRouteApi } from "@tanstack/react-router";
import { Filter, Handshake, Heart } from "lucide-react";
import { JSX } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useMediaQuery } from "usehooks-ts";
import type { LanguageCount, SongDB, SongLanguage } from "~/types/types";
import {
  LanguageFilter,
  LanguageFilterDropdownSection,
} from "./LanguageFilter";
import { SongBookFilter } from "./SongbookFilter";
import {
  VocalRangeDropdownSection,
  VocalRangeFilter,
} from "./VocalRangeFilter";
import React from "react";
import { useFilterSettingsStore } from "~/features/SongView/hooks/filterSettingsStore";
import { SongData } from "~/types/songData";

export type VocalRangeType = "all" | [number, number];

export interface FilterSettings {
  language: SongLanguage;
  vocalRange: VocalRangeType;
  capo: boolean;
  onlyFavorites: boolean;
}

// Common filter buttons used by both desktop and mobile views
const FilterControls = ({
  languages,
  maxRange,
  iconOnly,
  songs,
}: {
  languages: LanguageCount;
  maxRange: number | undefined;
  iconOnly: boolean;
  songs: SongData[];
}) => {
  const filterStore = useFilterSettingsStore();
  const {
    language,
    selectedSongbooks,
    vocalRange,
    capo,
    onlyFavorites,
    setLanguage,
    addSongbook,
    removeSongbook,
    setSelectedSongbooks,
    clearSongbooks,
    setVocalRange,
    toggleCapo,
    toggleFavorites,
  } = filterStore;

  const routeApi = getRouteApi("/");
  const { user, songDB } = routeApi.useLoaderData();
  const availableSongbooks = songDB.songbooks;
  return {
    controls: (
      <>
        <LanguageFilter
          languages={languages}
          selectedLanguage={language}
          setSelectedLanguage={setLanguage}
          iconOnly={iconOnly}
        />
        {availableSongbooks.length > 0 && (
          <SongBookFilter
            availableSongbooks={availableSongbooks}
            selectedSongbooks={selectedSongbooks}
            availableSongs={songs}
            addSongbook={addSongbook}
            removeSongbook={removeSongbook}
            setSelectedSongbooks={setSelectedSongbooks}
            clearSongbooks={clearSongbooks}
            iconOnly={iconOnly}
            sectionOnly={false}
          />
        )}
        <Button
          variant="circular"
          isActive={capo}
          className="rounded-none font-bold shadow-none outline-0"
          onClick={toggleCapo}
        >
          <Handshake />
          {!iconOnly && "Capo"}
        </Button>
        {user.loggedIn && (
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
        {maxRange && (
          <VocalRangeFilter
            maxRange={maxRange}
            vocalRangeFilter={vocalRange}
            setVocalRangeFilter={setVocalRange}
            iconOnly={iconOnly}
          />
        )}
      </>
    ),
    dropdownSections: (
      <>
        {user && (
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
        {maxRange &&
          VocalRangeDropdownSection(maxRange, vocalRange, setVocalRange)}
        {LanguageFilterDropdownSection(languages, language, setLanguage)}
        {availableSongbooks.length > 0 &&
          React.Children.toArray(
            <SongBookFilter
              availableSongbooks={availableSongbooks}
              selectedSongbooks={selectedSongbooks}
              availableSongs={songs}
              addSongbook={addSongbook}
              removeSongbook={removeSongbook}
              setSelectedSongbooks={setSelectedSongbooks}
              clearSongbooks={clearSongbooks}
              iconOnly={false}
              sectionOnly={true}
            />
          )}
      </>
    ),
    isFilterInactive:
      language === "all" &&
      (vocalRange === "all" ||
        (Array.isArray(vocalRange) &&
          vocalRange[0] === 0 &&
          vocalRange[1] === maxRange)) &&
      capo &&
      selectedSongbooks.length === availableSongbooks.length &&
      !onlyFavorites,
  };
};

const Filtering = ({ songDB }: { songDB: SongDB }): JSX.Element => {
  const isLargeScreen = useMediaQuery("only screen and (min-width : 1000px)");
  const { controls, dropdownSections, isFilterInactive } = FilterControls({
    languages: songDB.languages,
    maxRange: songDB.maxRange,
    songs: songDB.songs,
    iconOnly: isLargeScreen,
  });

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:flex outline-primary dark:outline-primary/30 rounded-full outline-2">
        {controls}
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
            className="dropdown-scroll no-scrollbar max-h-[80dvh] overflow-y-scroll"
            sideOffset={15}
          >
            {dropdownSections}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default Filtering;
