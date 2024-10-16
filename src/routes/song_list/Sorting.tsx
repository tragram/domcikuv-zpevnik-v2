
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownSection, DropdownTrigger } from "@nextui-org/react";
import { ArrowDown01, ArrowDown10, ArrowDownAZ, ArrowDownUp, ArrowDownZA, AudioLines, CalendarPlus, Check, MicVocal, Music } from "lucide-react";
import React, { ReactElement } from 'react';

import { ButtonGroup } from '@nextui-org/react';
import { SortField, SortOrder, SortSettings } from "../../types";

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
    field: SortField;
    title: string;
    icon: ReactElement;
    sorting_icons: SortingIcons;
}

const categories: Category[] = [
    { field: "title", title: "Title", icon: <AudioLines />, sorting_icons: letterSortingIcons },
    { field: "artist", title: "Artist", icon: <MicVocal />, sorting_icons: letterSortingIcons },
    { field: "dateAdded", title: "Date Added", icon: <CalendarPlus />, sorting_icons: numberSortingIcons },
    { field: "range", title: "Range", icon: <Music />, sorting_icons: numberSortingIcons },
]


function isActive(sorting_field: SortField, button_field: SortField) {
    return sorting_field === button_field;
}

function toggleSortOrder(sort_order: SortOrder): SortOrder {
    return sort_order === "descending" ? "ascending" : "descending";
}

function activeCategory(sorting_field: SortField): Category {
    return categories.find((cat) => cat.field === sorting_field)
}

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
        <Dropdown closeOnSelect={false} backdrop="opaque">
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
                    <DropdownItem
                        key="ascending_sort"
                        startContent={activeCategory(sortByField).sorting_icons.ascending}
                        endContent={sortOrder === "ascending" ? <Check /> : ""}
                        onPress={() => setSortOrder("ascending")}
                    >
                        Ascending
                    </DropdownItem>
                    <DropdownItem
                        key="descending_sort"
                        startContent={activeCategory(sortByField).sorting_icons.descending}
                        endContent={sortOrder === "descending" ? <Check /> : ""}
                        onPress={() => setSortOrder("descending")}
                    >
                        Descending
                    </DropdownItem>
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
    )
}


interface SortingProps {
    sortSettings: SortSettings;
    setSortSettings: React.Dispatch<React.SetStateAction<SortSettings>>
}

function Sorting({ sortSettings, setSortSettings }: SortingProps) {
    function setSortField(field: SortField) {
        setSortSettings({
            ...sortSettings,
            field: field
        })
    }

    function setSortOrder(order: SortOrder) {
        setSortSettings({ ...sortSettings, order: order })
    }
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