
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@nextui-org/react";
import { Check, Filter, Handshake, Languages, Music } from "lucide-react";
import React from 'react';

import { ButtonGroup } from '@nextui-org/react';
import { useMediaQuery } from "@uidotdev/usehooks";
import { Slider } from "@nextui-org/react";
import LanguageFlag from './LanguageFlag';
//TODO: icon for language in searchbar and possibly avatars https://nextui.org/docs/components/select
//TODO: why do buttons change size when they are selected/variant changed to 'solid'?

function languageChoices(languages) {
    function capitalizeFirstLetter(str) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
    }
    let language_choices = Object.keys(languages).map((language) => ({ text: capitalizeFirstLetter(language), value: language }));
    language_choices.unshift({ text: "All", value: "all" });
    return language_choices.map((choice) => (
        <DropdownItem key={choice.value} startContent={<LanguageFlag language={choice.text} />}>
            {choice.text}
        </DropdownItem>
    ))
}

function LanguageFilter({ languages, selectedLanguage, setSelectedLanguage, iconOnly }) {
    return (
        <Dropdown >
            <DropdownTrigger>
                <Button color="primary" variant={selectedLanguage == "all" ? "ghost" : "solid"}
                    startContent={iconOnly ? "" : <Languages />} isIconOnly={!iconOnly} disableAnimation
                >{iconOnly ? "Languages" : ""}
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Language Choices" onAction={(key) => setSelectedLanguage(key)}>
                {languageChoices(languages)}
            </DropdownMenu>
        </Dropdown>
    )
}

function VocalRangeSlider({ maxRange, vocalRange, setVocalRange }) {
    return (
        <Slider
            label="Semitones"
            step={1}
            minValue={0}
            maxValue={maxRange}
            defaultValue={vocalRange === "all" ? [0, maxRange] : vocalRange}
            formatOptions={{ style: "decimal" }}
            className="max-w-md"
            onChangeEnd={(value) => { setVocalRange(value) }} />
    )

}

function VocalRangeFilter({ maxRange, vocalRange, setVocalRange, iconOnly }) {
    return (
        <Dropdown>
            <DropdownTrigger>
                <Button
                    variant={vocalRange === "all" ? "ghost" : "solid"} color="primary" disableAnimation
                    startContent={iconOnly ? "" : <Music />} isIconOnly={!iconOnly}>{iconOnly ? "Range" : ""}
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Vocal range filter slider">
                <DropdownItem key="slider" closeOnSelect={false}>
                    <VocalRangeSlider maxRange={maxRange} vocalRange={vocalRange} setVocalRange={setVocalRange} />
                </DropdownItem>
                <DropdownItem key="reset" onClick={() => setVocalRange("all")}>Reset</DropdownItem>
            </DropdownMenu>
        </Dropdown>
    )
}

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


function Filtering({ languages, filterSettings, setFilterSettings, maxRange }) {
    const filterActive = filterSettings.language === "all" && filterSettings.vocal_range === "all" && filterSettings.capo;
    const setVocalRange = (range) => setFilterSettings({ ...filterSettings, vocal_range: range });
    const flipCapoSetting = () => setFilterSettings({ ...filterSettings, capo: !filterSettings.capo })
    return (
        <>
            <div className='hidden lg:flex'>
                <FilterButtons languages={languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={maxRange} />
            </div>
            <div className='lg:hidden'>
                <Dropdown>
                    <DropdownTrigger>
                        <Button
                            variant={filterActive ? "ghost" : "solid"} color="primary" disableAnimation
                            startContent={<Filter />} isIconOnly>
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Filtering">
                        <DropdownSection showDivider>
                            <DropdownItem onClick={flipCapoSetting} key="slider" closeOnSelect={false} endContent={filterSettings.capo ? <Check /> : ""}>
                                Allow capo
                            </DropdownItem>
                        </DropdownSection>

                        <DropdownSection showDivider title="Select song range">
                            <DropdownItem key="slider" closeOnSelect={false}>
                                <VocalRangeSlider maxRange={maxRange} vocalRange={filterSettings.vocal_range} setVocalRange={(range) => setVocalRange(range)} />
                            </DropdownItem>
                            <DropdownItem key="reset" onClick={() => setVocalRange("all")}>Reset

                            </DropdownItem>
                        </DropdownSection>

                        <DropdownSection title="Select languages">
                            {languageChoices(languages)}
                            {/* <DropdownItem key="languages" closeOnSelect={false}>
                            </DropdownItem> */}
                        </DropdownSection>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

export default Filtering;
