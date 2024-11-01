
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@nextui-org/react";
import { Music } from "lucide-react";

import { Slider } from "@nextui-org/react";

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

function VocalRangeDropdownSection(maxRange, vocalRange, setVocalRange) {
    return (
        <DropdownSection showDivider title="Select song range">
            <DropdownItem key="slider" closeOnSelect={false}>
                <VocalRangeSlider maxRange={maxRange} vocalRange={vocalRange} setVocalRange={(range) => setVocalRange(range)} />
            </DropdownItem>
            <DropdownItem key="reset" onClick={() => setVocalRange("all")}>
                Reset
            </DropdownItem>
        </DropdownSection>
    )
}

export { VocalRangeFilter, VocalRangeDropdownSection };