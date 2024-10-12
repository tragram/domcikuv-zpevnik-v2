
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@nextui-org/react";
import { Check, Filter, Handshake, Languages, Music } from "lucide-react";
import React from 'react';

import { ButtonGroup } from '@nextui-org/react';
import { useMediaQuery } from "@uidotdev/usehooks";
import { Slider } from "@nextui-org/react";
import LanguageFlag from './LanguageFlag';
//TODO: icon for language in searchbar and possibly avatars https://nextui.org/docs/components/select
//TODO: why do buttons change size when they are selected/variant changed to 'solid'?

function LanguageFilter({ languages, selectedLanguage, setSelectedLanguage, iconOnly }) {
    function capitalizeFirstLetter(str) {
        if (!str) return '';

        const firstCodePoint = str.codePointAt(0);
        const index = firstCodePoint > 0xFFFF ? 2 : 1;

        return String.fromCodePoint(firstCodePoint).toUpperCase() + str.slice(index);
    }
    let language_choices = Object.keys(languages).map((language) => ({ text: capitalizeFirstLetter(language), value: language }));

    return (
        <Dropdown >
            <DropdownTrigger>
                <Button color="primary" variant={selectedLanguage == "all" ? "ghost" : "solid"}
                    startContent={iconOnly ? "" : <Languages />} isIconOnly={!iconOnly} disableAnimation
                >{iconOnly ? "Languages" : ""}
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Language Choices" onAction={(key) => setSelectedLanguage(key)}>
                {language_choices.map((choice) => (
                    <DropdownItem key={choice.value} startContent={<LanguageFlag language={choice.text} />}>{choice.text}</DropdownItem>
                ))}
            </DropdownMenu>
        </Dropdown>
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
            <DropdownMenu aria-label="Static Actions">
                <DropdownItem key="slider" closeOnSelect={false}>
                    <Slider
                        label="Semitones"
                        step={1}
                        minValue={0}
                        maxValue={maxRange}
                        defaultValue={vocalRange === "all" ? [0, maxRange] : vocalRange}
                        formatOptions={{ style: "decimal" }}
                        className="max-w-md"
                        onChangeEnd={(value) => { setVocalRange(value) }} /></DropdownItem>
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
    return (
        <>
            <FilterButtons languages={languages} filterSettings={filterSettings} setFilterSettings={setFilterSettings} maxRange={maxRange} />
            <div className='max-lg:hidden'>
            </div>
            <div className='lg:hidden'>
            </div>
        </>
    )
}

export default Filtering;
