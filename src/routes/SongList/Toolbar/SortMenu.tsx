import { Button } from "@/components/ui/button"
import {
    DropdownIconStart,
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DropdownMenuCheckboxItemProps } from "@radix-ui/react-dropdown-menu"
import { ReactElement, useState } from "react"
import FancySwitch from "@/components/ui/fancy-switch"
import { SortField, SortOrder, SortSettings } from "@/types"
import { ArrowDownAZ, ArrowDownZA, ArrowDown01, ArrowDown10, AudioLines, MicVocal, CalendarPlus, Music, ArrowDownUp } from "lucide-react"

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
    sorting_labels: {
        ascending: string,
        descending: string,
    }
}

const categories: Category[] = [
    { field: "title", title: "Title", icon: <AudioLines />, sorting_icons: letterSortingIcons, sorting_labels: { ascending: "Ascending", descending: "Descending" } },
    { field: "artist", title: "Artist", icon: <MicVocal />, sorting_icons: letterSortingIcons, sorting_labels: { ascending: "Ascending", descending: "Descending" } },
    { field: "dateAdded", title: "Date Added", icon: <CalendarPlus />, sorting_icons: numberSortingIcons, sorting_labels: { ascending: "Lucie Bílá → Vivaldi", descending: "Vivaldi → Lucie Bílá" } },
    { field: "range", title: "Range", icon: <Music />, sorting_icons: numberSortingIcons, sorting_labels: { ascending: "Me → Freddie", descending: "Freddie → Me" } },
]


function isActive(sortingField: SortField, buttonField: SortField) {
    return sortingField === buttonField;
}

function toggleSortOrder(sortOrder: SortOrder): SortOrder {
    return sortOrder === "descending" ? "ascending" : "descending";
}

function activeCategory(sortingField: SortField): Category {
    return categories.find((cat) => cat.field === sortingField)
}

interface SortMenuProps {
    sortByField: SortField,
    setSortField: (field: SortField) => void,
    sortOrder: SortOrder,
    setSortOrder: (order: SortOrder) => void
}

interface SortMenuProps {
    sortSettings: SortSettings;
    setSortSettings: React.Dispatch<React.SetStateAction<SortSettings>>
}

function SortMenu({ sortSettings, setSortSettings }: SortMenuProps) {
    // just convenience functions to make inline specs shorter
    function setSortField(field: SortField) {
        setSortSettings({
            ...sortSettings,
            field: field
        })
    }
    const sortByField = sortSettings.field;
    const sortOrder = sortSettings.order;

    function setSortOrder(order: SortOrder) {
        setSortSettings({ ...sortSettings, order: order })
    }

    return (<>
        <div className="flex md:hidden">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="circular"><ArrowDownUp size={32} /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Sorting method</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {categories.map(category => (
                        <DropdownMenuCheckboxItem key={category.field}
                            onSelect={e => e.preventDefault()}
                            checked={isActive(sortByField, category.field)}
                            onCheckedChange={() => setSortField(category.field)}>
                            <DropdownIconStart icon={category.icon} />
                            {category.title}
                        </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuLabel>Direction</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                        key="ascending_sort"
                        checked={sortOrder === "ascending"}
                        onCheckedChange={() => setSortOrder("ascending")}
                    >
                        <DropdownIconStart icon={activeCategory(sortByField).sorting_icons.ascending} />
                        {activeCategory(sortByField).sorting_labels.ascending}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        key="descending_sort"
                        checked={sortOrder === "descending"}
                        onCheckedChange={() => setSortOrder("descending")}
                    >
                        <DropdownIconStart icon={activeCategory(sortByField).sorting_icons.descending} />
                        {activeCategory(sortByField).sorting_labels.descending}
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div className="hidden md:flex h-full w-fit">
            <FancySwitch options={categories.map(c => { return { "label": c.title, "value": c.field } })} setSelectedOption={(value: SortField) => { setSortField(value) }} selectedOption={sortByField} roundedClass={"rounded-l-full"} >
                <Button className="rounded-r-full" onClick={() => setSortOrder(toggleSortOrder(sortOrder))}>{activeCategory(sortByField).sorting_icons[sortOrder]}</Button>
            </FancySwitch>
        </div>
    </>
    )
}

export default SortMenu;