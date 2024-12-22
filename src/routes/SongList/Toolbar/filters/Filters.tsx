import { Filter, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useMediaQuery } from "@uidotdev/usehooks";
import { LanguageFilter, LanguageFilterDropdownSection } from "./LanguageFilter";
import { VocalRangeDropdownSection, VocalRangeFilter } from "./VocalRangeFilter";

type VocalRangeType = "all" | [number, number];

interface FilterSettings {
    language: string;
    vocalRange: VocalRangeType;
    capo: boolean;
}

interface FilterProps {
    languages: string[];
    filterSettings: FilterSettings;
    setFilterSettings: (settings: FilterSettings) => void;
    maxRange: number;
}

interface FilterButtonsProps extends FilterProps {
    iconOnly: boolean;
}

const FilterButtons = ({
    languages,
    filterSettings,
    setFilterSettings,
    maxRange,
    iconOnly
}: FilterButtonsProps): JSX.Element => {
    const updateFilterSetting = <K extends keyof FilterSettings>(
        key: K,
        value: FilterSettings[K]
    ): void => {
        setFilterSettings({
            ...filterSettings,
            [key]: value
        });
    };

    return (
        <div className="flex outline outline-primary dark:outline-primary/30 rounded-full outline-2">
            <LanguageFilter
                languages={languages}
                selectedLanguage={filterSettings.language}
                setSelectedLanguage={(language: string) =>
                    updateFilterSetting('language', language)
                }
                iconOnly={iconOnly}
            />
            <Button
                variant="circular"
                isActive={filterSettings.capo}
                className="font-bold rounded-none outline-0 shadow-none"
                onClick={() => updateFilterSetting('capo', !filterSettings.capo)}
            >
                <Handshake />
                {!iconOnly && "Capo"}
            </Button>
            <VocalRangeFilter
                maxRange={maxRange}
                vocalRangeFilter={filterSettings.vocalRange}
                setVocalRangeFilter={(range: VocalRangeType) =>
                    updateFilterSetting('vocalRange', range)
                }
                iconOnly={iconOnly}
            />
        </div>
    );
};

const Filtering = ({
    languages,
    filterSettings,
    setFilterSettings,
    maxRange
}: FilterProps): JSX.Element => {
    const isLargeScreen = useMediaQuery("only screen and (min-width : 1000px)");

    const isFilterInactive = (
        filterSettings.language === "all" &&
        (filterSettings.vocalRange === "all" || (
            Array.isArray(filterSettings.vocalRange) &&
            filterSettings.vocalRange[0] === 0 &&
            filterSettings.vocalRange[1] === maxRange
        )) &&
        filterSettings.capo
    );

    const updateFilterSetting = <K extends keyof FilterSettings>(
        key: K,
        value: FilterSettings[K]
    ): void => {
        setFilterSettings({
            ...filterSettings,
            [key]: value
        });
    };

    return (
        <>
            {/* Desktop View */}
            <div className="hidden lg:flex">
                <FilterButtons
                    languages={languages}
                    filterSettings={filterSettings}
                    setFilterSettings={setFilterSettings}
                    maxRange={maxRange}
                    iconOnly={isLargeScreen}
                />
            </div>

            {/* Mobile View */}
            <div className="lg:hidden">
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="circular"
                            isActive={!isFilterInactive}
                        >
                            <Filter />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        aria-label="Filtering"
                        className="dropdown-scroll no-scrollbar w-52 max-h-[80vh] overflow-y-scroll"
                    >
                        <DropdownMenuCheckboxItem
                            onClick={() => updateFilterSetting('capo', !filterSettings.capo)}
                            onSelect={e => e.preventDefault()}
                            checked={filterSettings.capo}
                        >
                            Allow capo
                        </DropdownMenuCheckboxItem>

                        {VocalRangeDropdownSection(
                            maxRange,
                            filterSettings.vocalRange,
                            (range: VocalRangeType) =>
                                updateFilterSetting('vocalRange', range)
                        )}
                        {LanguageFilterDropdownSection(
                            languages,
                            filterSettings.language,
                            (language: string) =>
                                updateFilterSetting('language', language),

                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    );
};

export default Filtering;