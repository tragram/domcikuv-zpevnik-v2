
import { Check, Filter, Handshake } from "lucide-react";

import { useMediaQuery } from "@uidotdev/usehooks";
import { LanguageFilter, LanguageFilterDropdownSection } from "./LanguageFilter";
import { VocalRangeDropdownSection, VocalRangeFilter } from "./VocalRangeFilter";
import { Button } from "@/components/ui/button";
import LanguageFlag from "@/components/LanguageFlag";
import { SongLanguage } from "@/types";
import { DropdownMenuItem, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu"

function FilterButtons({ languages, filterSettings, setFilterSettings, maxRange }) {
    const iconOnly = useMediaQuery(
        "only screen and (min-width : 1000px)"
    );
    return (
        <div className="flex outline outline-primary dark:outline-primary/30 rounded-full outline-2">
            <LanguageFilter languages={languages} selectedLanguage={filterSettings.language} setSelectedLanguage={(language: string) => setFilterSettings({ ...filterSettings, language: language })} iconOnly={iconOnly} />
            <Button variant="circular" isActive={filterSettings.capo} className={"font-bold rounded-none outline-0 shadow-none"}
                // variant={filterSettings.capo ? "solid" : "bordered"}
                onClick={() => { setFilterSettings({ ...filterSettings, capo: !filterSettings.capo }) }}><Handshake /> Capo</Button>
            <VocalRangeFilter maxRange={maxRange} vocalRangeFilter={filterSettings.vocal_range} setVocalRangeFilter={(range) => setFilterSettings({ ...filterSettings, vocal_range: range })} iconOnly={iconOnly} />
        </div>
    )
}

function Filtering({ languages, filterSettings, setFilterSettings, maxRange }) {
    // TODO: this is actually filter inactive...
    const filterInactive = filterSettings.language === "all" && (filterSettings.vocal_range === "all" || (filterSettings.vocal_range[0] == 0 && filterSettings.vocal_range[1] == maxRange)) && filterSettings.capo;
    const setVocalRange = (range) => setFilterSettings({ ...filterSettings, vocal_range: range });
    const flipCapoSetting = () => setFilterSettings({ ...filterSettings, capo: !filterSettings.capo })
    const setSelectedLanguage = (language) => setFilterSettings({ ...filterSettings, language: language })
    return (
        <>
            <div className='hidden lg:flex'>
                <FilterButtons languages={languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={maxRange} />
            </div>
            <div className='lg:hidden'>
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="circular" isActive={!filterInactive}>
                            <Filter />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent aria-label="Filtering" className="dropdown-scroll no-scrollbar w-52  max-h-[80vh] overflow-y-scroll">
                        <DropdownMenuCheckboxItem onClick={flipCapoSetting} key="slider" onSelect={e => e.preventDefault()} checked={filterSettings.capo}>
                            Allow capo
                        </DropdownMenuCheckboxItem>

                        {VocalRangeDropdownSection(maxRange, filterSettings.vocal_range, setVocalRange)}
                        {LanguageFilterDropdownSection(languages, filterSettings.language, setSelectedLanguage)}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </>
    )
}

export default Filtering;