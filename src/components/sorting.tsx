
import React, { useState, useEffect, ReactElement } from 'react';
import { Check, AudioLines, MicVocal, CalendarPlus, Music, ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownZA } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownSection, DropdownItem, Button } from "@nextui-org/react";

import { ButtonGroup } from '@nextui-org/react';

interface SortingIcons {
    ascending: ReactElement;
    descending: ReactElement;
}

const letterSortingIcons: SortingIcons = {
    ascending: <ArrowDownAZ />, descending: <ArrowDownZA />
}

const numberSortingIcons: SortingIcons = {
    ascending: <ArrowDown01 />, descending: <ArrowDown10 />
}

interface Category {
    field: string;
    title: string;
    icon: ReactElement;
    sorting_icons: SortingIcons;
}

const categories: Category[] = [
    { field: "title", title: "Title", icon: <AudioLines />, sorting_icons: letterSortingIcons },
    { field: "artist", title: "Artist", icon: <MicVocal />, sorting_icons: letterSortingIcons },
    { field: "date_added", title: "Date Added", icon: <CalendarPlus />, sorting_icons: numberSortingIcons },
    { field: "range", title: "Range", icon: <Music />, sorting_icons: numberSortingIcons },
]


function isActive(sorting_field: string, button_field: string) {
    return sorting_field === button_field;
}

function toggleSortType(sort_type: string) {
    return sort_type === "descending" ? "ascending" : "descending";
}

function activeCategory(sort_field): Category {
    return categories.find((cat) => cat.field === sort_field)
}

function SortButtons({ sortByField, setSortField, sortType, setSortType }) {
    return (
        <ButtonGroup>
            {categories.map(category => (
                <Button color="primary" variant={isActive(sortByField, category.field) ? 'solid' : 'ghost'} size="md" className="max-w-24" key={category.field} onClick={() => { setSortField(category.field) }}>{category.title}</Button>
            ))}
            <Button isIconOnly color="primary" onClick={() => setSortType(toggleSortType(sortType))}>
                {activeCategory(sortByField).sorting_icons[sortType]}
            </Button>
        </ButtonGroup >
    )
}


function SortButtonMobile({ sortByField, setSortField, sortType, setSortType }) {
    return (
        <Dropdown closeOnSelect={false}>
            <DropdownTrigger>
                <Button
                    variant="ghost"
                    color="primary"
                    className="lg:hidden"
                >
                    Sorting
                </Button>
            </DropdownTrigger>
            <DropdownMenu variant="faded" aria-label="Sorting dropdown menu">
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
                    <DropdownItem
                        key="ascending_sort"
                        startContent={activeCategory(sortByField).sorting_icons.ascending}
                        endContent={sortType === "ascending" ? <Check /> : ""}
                        onPress={() => setSortType("ascending")}
                    >
                        Ascending
                    </DropdownItem>
                    <DropdownItem
                        key="descending_sort"
                        startContent={activeCategory(sortByField).sorting_icons.descending}
                        endContent={sortType === "descending" ? <Check /> : ""}
                        onPress={() => setSortType("descending")}
                    >
                        Descending
                    </DropdownItem>
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
    )
}

function Sorting({ songFiltering, setSongFiltering }) {
    function setSortField(field: string) {
        setSongFiltering({
            ...songFiltering,
            sortByField: field
        })
    }

    function setSortType(type: string) {
        setSongFiltering({ ...songFiltering, sortType: type })
    }
    return (
        <>
            <div className='max-lg:hidden'>
                <SortButtons sortByField={songFiltering.sortByField} setSortField={setSortField} sortType={songFiltering.sortType} setSortType={setSortType} />
            </div>
            <div className='lg:hidden'>
                <SortButtonMobile sortByField={songFiltering.sortByField} setSortField={setSortField} sortType={songFiltering.sortType} setSortType={setSortType} />
            </div>
        </>
    )
}

export default Sorting;