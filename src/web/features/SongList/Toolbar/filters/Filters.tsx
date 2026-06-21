import { Filter, Globe, Heart, X } from "lucide-react";
import CapoIcon from "./capo_icon";
import { JSX } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useMediaQuery } from "usehooks-ts";
import type {
  LanguageCount,
  Songbook,
  SongDB,
  SongLanguage,
} from "~/types/types";
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
import type { UserData } from "~/hooks/use-user-data";

export type VocalRangeType = "all" | [number, number];

export interface FilterSettings {
  language: SongLanguage;
  vocalRange: VocalRangeType;
  hideCapo: boolean;
  onlyFavorites: boolean;
  showExternal: boolean;
}

// Common filter buttons used by both desktop and mobile views
const FilterControls = ({
  languages,
  maxRange,
  iconOnly,
  availableSongbooks,
  userData,
}: {
  languages: LanguageCount;
  maxRange: number | undefined;
  iconOnly: boolean;
  availableSongbooks: Songbook[];
  userData: UserData;
}) => {
  const {
    language,
    selectedSongbookId,
    vocalRange,
    hideCapo,
    showExternal,
    onlyFavorites,
    setLanguage,
    toggleSongbook,
    setVocalRange,
    toggleHideCapo,
    toggleShowExternal,
    toggleFavorites,
    resetFilters,
  } = useFilterSettingsStore();
  const isFilterInactive =
    language === "all" &&
    (vocalRange === "all" ||
      (Array.isArray(vocalRange) &&
        vocalRange[0] === 0 &&
        vocalRange[1] === maxRange)) &&
    !hideCapo &&
    !selectedSongbookId &&
    !onlyFavorites;
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
            selectedSongbookId={selectedSongbookId}
            toggleSongbook={toggleSongbook}
            iconOnly={iconOnly}
            sectionOnly={false}
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="circular"
              isActive={hideCapo}
              className="rounded-none font-bold shadow-none outline-0"
              onClick={toggleHideCapo}
            >
              <CapoIcon />
              {!iconOnly && "No capo"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Hide songs that need a capo</p>
          </TooltipContent>
        </Tooltip>

        {userData && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="circular"
                isActive={onlyFavorites}
                className="rounded-none font-bold shadow-none outline-0"
                onClick={toggleFavorites}
              >
                <Heart />
                {!iconOnly && "Favorites only"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Favorites only</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="circular"
              isActive={showExternal}
              className="rounded-none font-bold shadow-none outline-0"
              onClick={toggleShowExternal}
            >
              <Globe />
              {!iconOnly && "Show external"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Show external songs</p>
          </TooltipContent>
        </Tooltip>

        {maxRange && (
          <VocalRangeFilter
            maxRange={maxRange}
            vocalRangeFilter={vocalRange}
            setVocalRangeFilter={setVocalRange}
            iconOnly={iconOnly}
            roundedRight={isFilterInactive}
          />
        )}
        {!isFilterInactive && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="circular"
                className="rounded-l-none font-bold shadow-none outline-0"
                onClick={resetFilters}
              >
                <X />
                {!iconOnly && "Reset"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Reset all filters</p>
            </TooltipContent>
          </Tooltip>
        )}
      </>
    ),
    dropdownSections: (
      <>
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
          onClick={toggleHideCapo}
          onSelect={(e) => e.preventDefault()}
          checked={hideCapo}
        >
          Hide capo songs
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          onClick={toggleShowExternal}
          onSelect={(e) => e.preventDefault()}
          checked={showExternal}
        >
          Show external songs
        </DropdownMenuCheckboxItem>
        {maxRange &&
          VocalRangeDropdownSection(maxRange, vocalRange, setVocalRange)}
        {LanguageFilterDropdownSection(languages, language, setLanguage)}
        {availableSongbooks.length > 0 &&
          React.Children.toArray(
            <SongBookFilter
              availableSongbooks={availableSongbooks}
              selectedSongbookId={selectedSongbookId}
              toggleSongbook={toggleSongbook}
              iconOnly={false}
              sectionOnly={true}
            />,
          )}
        {!isFilterInactive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={resetFilters}>
              <X />
              Reset all filters
            </DropdownMenuItem>
          </>
        )}
      </>
    ),
    isFilterInactive,
  };
};

const Filtering = ({
  songDB,
  userData,
}: {
  songDB: SongDB;
  userData: UserData;
}): JSX.Element => {
  const isLargeScreen = useMediaQuery("only screen and (min-width : 1000px)");
  const { controls, dropdownSections, isFilterInactive } = FilterControls({
    languages: songDB.languages,
    maxRange: songDB.maxRange,
    availableSongbooks: songDB.songbooks,
    userData,
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
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="circular"
                  isActive={!isFilterInactive}
                >
                  <Filter />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filter songs</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            aria-label="Filtering"
            className="dropdown-scroll no-scrollbar max-h-[80dvh] overflow-y-scroll m-2 w-[calc(100dvw-1rem)] max-w-72"
          >
            {dropdownSections}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default Filtering;
