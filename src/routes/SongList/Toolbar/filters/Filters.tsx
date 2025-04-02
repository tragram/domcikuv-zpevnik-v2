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
import { create } from 'zustand'
import { persist } from "zustand/middleware"
import { LanguageCount, SongLanguage } from "@/types/types";

type VocalRangeType = "all" | [number, number];

interface FilterSettings {
    language: SongLanguage;
    vocalRange: VocalRangeType;
    capo: boolean;
}

interface FilterProps {
    languages: LanguageCount
    maxRange: number;
}

interface FilterButtonsProps extends FilterProps {
    iconOnly: boolean;
}

interface FilterSettingsState extends FilterSettings {
    setLanguage: (language: string) => void;
    setVocalRange: (range: VocalRangeType) => void;
    setCapo: (capo: boolean) => void;
    toggleCapo: () => void;
}

export const useFilterSettingsStore = create<FilterSettingsState>()(
    persist(
        (set) => ({
            language: "all",
            vocalRange: "all",
            capo: true,
            setLanguage: (language: string) => set({ language: language }),
            setVocalRange: (range: VocalRangeType) => set({ vocalRange: range }),
            setCapo: (capo: boolean) => set({ capo: capo }),
            toggleCapo: () => set((state) => ({ capo: !state.capo }))
        }),
        {
            name: 'filter-settings-store'
        }
    )
)

const FilterButtons = ({
    languages,
    maxRange,
    iconOnly
}: FilterButtonsProps): JSX.Element => {
    const { language, vocalRange, capo, setLanguage, setVocalRange, toggleCapo } = useFilterSettingsStore();

    return (
        <div className="flex outline outline-primary dark:outline-primary/30 rounded-full outline-2">
            <LanguageFilter
                languages={languages}
                selectedLanguage={language}
                setSelectedLanguage={setLanguage}
                iconOnly={iconOnly}
            />
            <Button
                variant="circular"
                isActive={capo}
                className="font-bold rounded-none outline-0 shadow-none"
                onClick={toggleCapo}
            >
                <Handshake />
                {!iconOnly && "Capo"}
            </Button>
            <VocalRangeFilter
                maxRange={maxRange}
                vocalRangeFilter={vocalRange}
                setVocalRangeFilter={setVocalRange}
                iconOnly={iconOnly}
            />
        </div>
    );
};

const Filtering = ({
    languages,
    maxRange
}: FilterProps): JSX.Element => {
    const { language, vocalRange, capo, setLanguage, setVocalRange, toggleCapo } = useFilterSettingsStore();
    const isLargeScreen = useMediaQuery("only screen and (min-width : 1000px)");

    const isFilterInactive = (
        language === "all" &&
        (vocalRange === "all" || (
            Array.isArray(vocalRange) &&
            vocalRange[0] === 0 &&
            vocalRange[1] === maxRange
        )) &&
        capo
    );

    return (
        <>
            {/* Desktop View */}
            <div className="hidden lg:flex">
                <FilterButtons
                    languages={languages}
                    maxRange={maxRange}
                    iconOnly={isLargeScreen}
                />
            </div>

            {/* Mobile View */}
            <div className="lg:hidden">
                <DropdownMenu>
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
                        className="dropdown-scroll no-scrollbar w-52 max-h-[80dvh] overflow-y-scroll"
                        sideOffset={15}
                    >
                        <DropdownMenuCheckboxItem
                            onClick={toggleCapo}
                            onSelect={e => e.preventDefault()}
                            checked={capo}
                        >
                            Allow capo
                        </DropdownMenuCheckboxItem>

                        {VocalRangeDropdownSection(
                            maxRange,
                            vocalRange,
                            setVocalRange
                        )}
                        {LanguageFilterDropdownSection(
                            languages,
                            language,
                            setLanguage
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    );
};

export default Filtering;