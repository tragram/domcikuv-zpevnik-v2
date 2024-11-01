
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@nextui-org/react";
import { ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownUp, ArrowDownZA, AudioLines, CalendarPlus, Check, MicVocal, Music } from "lucide-react";
import React, { ReactElement } from 'react';

import { ButtonGroup } from '@nextui-org/react';
import { SortField, SortOrder, SortSettings } from "../../types";

interface SortButtonProps {
    sortByField: SortField,
    setSortField: (field: SortField) => void,
    sortOrder: SortOrder,
    setSortOrder: (order: SortOrder) => void
}

function SortButtons({ sortByField, setSortField, sortOrder, setSortOrder }: SortButtonProps) {
    return (
        <ButtonGroup>
            {categories.map(category => (
                <Button color="primary" variant={isActive(sortByField, category.field) ? 'solid' : 'ghost'} size="md" className="max-w-24" key={category.field} onClick={() => { setSortField(category.field) }}>{category.title}</Button>
            ))}
            <Button isIconOnly color="primary" onClick={() => setSortOrder(toggleSortOrder(sortOrder))}>
                {activeCategory(sortByField).sorting_icons[sortOrder]}
            </Button>
        </ButtonGroup >
    )
}


function SortButtonMobile({ sortByField, setSortField, sortOrder, setSortOrder }: SortButtonProps) {
    return (
        <Dropdown closeOnSelect={false} backdrop="opaque" disableAnimation>
            <DropdownTrigger>
                <Button
                    variant="ghost"
                    color="primary"
                    isIconOnly
                >
                    <ArrowDownUp />
                </Button>
            </DropdownTrigger>
            <DropdownMenu variant="faded" aria-label="Sorting dropdown menu" className="dropdown-scroll">
                <DropdownSection title="Sorting method" showDivider>
                    {categories.map(category => (
                        <DropdownItem key={category.field} startContent={category.icon}
                            endContent={isActive(sortByField, category.field) ? <Check /> : ""}
                            onPress={() => setSortField(category.field)}>
                            {category.title}
                        </DropdownItem>
                    ))}
                </DropdownSection>
                <DropdownSection title="Direction" >
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
    )
}


function Sorting({ sortSettings, setSortSettings }: SortingProps) {

    return (
        <>
            <div className='max-lg:hidden'>
                <SortButtons sortByField={sortSettings.field} setSortField={setSortField} sortOrder={sortSettings.order} setSortOrder={setSortOrder} />
            </div>
            <div className='lg:hidden'>
                <SortButtonMobile sortByField={sortSettings.field} setSortField={setSortField} sortOrder={sortSettings.order} setSortOrder={setSortOrder} />
            </div>
        </>
    )
}

export default Sorting;