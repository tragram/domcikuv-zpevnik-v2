import { Filter, Heart, X } from "lucide-react";
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
  onlyFavorites: boolean;
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
    onlyFavorites,
    setLanguage,
    toggleSongbook,
    setVocalRange,
    toggleFavorites,
    resetFilters,
  } = useFilterSettingsStore();
  const isFilterInactive =
    language === "all" &&
    (vocalRange === "all" ||
      (Array.isArray(vocalRange) &&
        vocalRange[0] === 0 &&
        vocalRange[1] === maxRange)) &&
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

        {maxRange && (
          <VocalRangeFilter
            maxRange={maxRange}
            vocalRangeFilter={vocalRange}
            setVocalRangeFilter={setVocalRange}
            iconOnly={iconOnly}
            roundedRight={false}
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="circular"
              className="rounded-l-none font-bold shadow-none outline-0 disabled:opacity-100 disabled:text-primary/50"
              onClick={resetFilters}
              disabled={isFilterInactive}
              aria-label="Reset all filters"
            >
              <X />
              {!iconOnly && "Reset"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reset all filters</p>
          </TooltipContent>
        </Tooltip>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={resetFilters} disabled={isFilterInactive}>
          <X />
          Reset all filters
        </DropdownMenuItem>
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
      <div className="hidden lg:flex outline-border rounded-full outline-2">
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
