import React, { useState, useEffect } from 'react';
import { Button } from '@nextui-org/react';
import { Slider } from "@nextui-org/react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem } from "@nextui-org/dropdown";
//TODO: select should have a default value
function VocalRangeFilter({ maxRange, vocalRange, setVocalRange }) {
    return (
        <Dropdown>
            <DropdownTrigger>
                <Button
                    variant={vocalRange == "all" ? "bordered" : "solid"} color="primary"
                >
                    Range
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

export default VocalRangeFilter;