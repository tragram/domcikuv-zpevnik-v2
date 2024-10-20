
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@nextui-org/react";
import { Check, Filter, Handshake } from "lucide-react";

import { ButtonGroup } from '@nextui-org/react';
import { useMediaQuery } from "@uidotdev/usehooks";
import { LanguageFilter, LanguageFilterDropdownSection } from "./LanguageFilter";
import { VocalRangeDropdownSection, VocalRangeFilter } from "./VocalRangeFilter";
import { SongLanguage } from "../../../types";
import LanguageFlag from "../LanguageFlag";

//TODO: why do buttons change size when they are selected/variant changed to 'solid'?

function FilterButtons({ languages, filterSettings, setFilterSettings, maxRange }) {
    const iconOnly = useMediaQuery(
        "only screen and (min-width : 1000px)"
    );
    return (
        <ButtonGroup>
            <Button isIconOnly color="primary" variant="bordered"
                data-hover={false} disableAnimation disableRipple>
                <Filter className="stroke-gray-400" />
            </Button>
            <LanguageFilter languages={languages} selectedLanguage={filterSettings.language} setSelectedLanguage={(language: string) => setFilterSettings({ ...filterSettings, language: language })} iconOnly={iconOnly} />
            <Button fullWidth={true} disableAnimation color="primary" variant={filterSettings.capo ? "solid" : "bordered"} onClick={() => { setFilterSettings({ ...filterSettings, capo: !filterSettings.capo }) }} startContent={iconOnly ? "" : <Handshake />} isIconOnly={!iconOnly}>{iconOnly ? "Capo" : ""}</Button>
            <VocalRangeFilter maxRange={maxRange} vocalRange={filterSettings.vocal_range} setVocalRange={(range) => setFilterSettings({ ...filterSettings, vocal_range: range })} iconOnly={iconOnly} />
        </ButtonGroup>)
}

function languageChoices(languages: Array<SongLanguage>, selectedLanguage, setSelectedLanguage) {
    function capitalizeFirstLetter(str) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
    }
    let language_choices = Object.keys(languages).map((language) => ({ text: capitalizeFirstLetter(language), value: language }));
    language_choices.unshift({ text: "All", value: "all" });
    return language_choices.map((choice) => (
        <DropdownItem key={choice.value} closeOnSelect={false} startContent={<LanguageFlag language={choice.text} />} endContent={selectedLanguage === choice.value ? <Check /> : ""} onClick={() => setSelectedLanguage(choice.value)}>
            {choice.text}
        </DropdownItem>
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
                <Dropdown backdrop="opaque" disableAnimation>
                    <DropdownTrigger>
                        <Button
                            variant={filterActive ? "ghost" : "solid"} color="primary" disableAnimation
                            startContent={<Filter />} isIconOnly>
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Filtering" className="dropdown-scroll no-scrollbar">
                        <DropdownSection showDivider>
                            <DropdownItem onClick={flipCapoSetting} key="slider" closeOnSelect={false} endContent={filterSettings.capo ? <Check /> : ""}>
                                Allow capo
                            </DropdownItem>
                        </DropdownSection>

                        {VocalRangeDropdownSection(maxRange, filterSettings.vocal_range, setVocalRange)}
                        {LanguageFilterDropdownSection(languages, filterSettings.language, setSelectedLanguage)}
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

export default Filtering;