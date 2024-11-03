
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
        <div className="flex">
            {/* <Button size="icon" variant="circular">
                <Filter className="stroke-gray-400" />
            </Button> */}
            <LanguageFilter languages={languages} selectedLanguage={filterSettings.language} setSelectedLanguage={(language: string) => setFilterSettings({ ...filterSettings, language: language })} iconOnly={iconOnly} />
            <Button variant="circular" className=" rounded-none border-x-background border-x-4"
                // variant={filterSettings.capo ? "solid" : "bordered"}
                onClick={() => { setFilterSettings({ ...filterSettings, capo: !filterSettings.capo }) }} startContent={iconOnly ? "" : <Handshake />} isIconOnly={!iconOnly}>{iconOnly ? "Capo" : ""}</Button>
            <VocalRangeFilter maxRange={maxRange} vocalRangeFilter={filterSettings.vocal_range} setVocalRangeFilter={(range) => setFilterSettings({ ...filterSettings, vocal_range: range })} iconOnly={iconOnly} />
        </div>
    )
}

function languageChoices(languages: Array<SongLanguage>, selectedLanguage, setSelectedLanguage) {
    function capitalizeFirstLetter(str) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
    }
    const language_choices = Object.keys(languages).map((language) => ({ text: capitalizeFirstLetter(language), value: language }));
    language_choices.unshift({ text: "All", value: "all" });
    return language_choices.map((choice) => (
        <DropdownMenuItem key={choice.value}
            onSelect={e => e.preventDefault()}
            startContent={<LanguageFlag language={choice.text} />}
            endContent={selectedLanguage === choice.value ? <Check /> : ""}
            onClick={() => setSelectedLanguage(choice.value)}>
            {choice.text}
        </DropdownMenuItem>
    ))
}


function Filtering({ languages, filterSettings, setFilterSettings, maxRange }) {
    const filterActive = filterSettings.language === "all" && filterSettings.vocal_range === "all" && filterSettings.capo;
    const setVocalRange = (range) => setFilterSettings({ ...filterSettings, vocal_range: range });
    const flipCapoSetting = () => setFilterSettings({ ...filterSettings, capo: !filterSettings.capo })
    const setSelectedLanguage = (language) => setFilterSettings({ ...filterSettings, language: language })
    return (
        <>
            <div className='hidden lg:flex'>
                <FilterButtons languages={languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={maxRange} />
            </div>
            <div className='lg:hidden'>
                <DropdownMenu>
                    <DropdownMenuTrigger>
                        <Button size="icon" variant="circular">
                            {<Filter />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent aria-label="Filtering" className="dropdown-scroll no-scrollbar">
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