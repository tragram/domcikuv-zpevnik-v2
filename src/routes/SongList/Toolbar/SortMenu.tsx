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
import FancySwitch from "@/components/ui/fancy-switch"
import { SortField, SortOrder, SortSettings } from "@/types/types"
import {
    ArrowDown01,
    ArrowDown10,
    ArrowDownAZ,
    ArrowDownUp,
    ArrowDownZA,
    AudioLines,
    CalendarPlus,
    MicVocal,
    Music
} from "lucide-react"
import { ReactElement } from "react"
import { create } from 'zustand'
import { persist } from "zustand/middleware"

interface SortSettingsState extends SortSettings {
    setSortOrder: (sortOrder: SortOrder) => void;
    setSortField: (sortField: SortField) => void;
}

export const useSortSettingsStore = create<SortSettingsState>()(
    persist(
        (set) => ({
            order: "ascending" as SortOrder,
            field: "title" as SortField,
            setSortOrder: (sortOrder: SortOrder) => set({
                order: sortOrder
            }),
            setSortField: (sortField: SortField) => set({
                field: sortField
            })

        }),
        {
            name: 'sort-settings-store'
        }
    )
)

interface SortingIcons {
    ascending: ReactElement;
    descending: ReactElement;
}

interface SortingLabels {
    ascending: string;
    descending: string;
}

interface Category {
    field: SortField;
    title: string;
    icon: ReactElement;
    sorting_icons: SortingIcons;
    sorting_labels: SortingLabels;
}

interface SwitchOption {
    label: string;
    value: SortField;
}

const letterSortingIcons: SortingIcons = {
    ascending: <ArrowDownAZ />,
    descending: <ArrowDownZA />
};

const numberSortingIcons: SortingIcons = {
    ascending: <ArrowDown01 />,
    descending: <ArrowDown10 />
};

const categories: Category[] = [
    {
        field: "title",
        title: "Title",
        icon: <AudioLines />,
        sorting_icons: letterSortingIcons,
        sorting_labels: {
            ascending: "Ascending",
            descending: "Descending"
        }
    },
    {
        field: "artist",
        title: "Artist",
        icon: <MicVocal />,
        sorting_icons: letterSortingIcons,
        sorting_labels: {
            ascending: "Ascending",
            descending: "Descending"
        }
    },
    {
        field: "dateAdded",
        title: "Date Added",
        icon: <CalendarPlus />,
        sorting_icons: numberSortingIcons,
        sorting_labels: {
            ascending: "Lucie Bílá → Vivaldi",
            descending: "Vivaldi → Lucie Bílá"
        }
    },
    {
        field: "range",
        title: "Range",
        icon: <Music />,
        sorting_icons: numberSortingIcons,
        sorting_labels: {
            ascending: "Me → Freddie",
            descending: "Freddie → Me"
        }
    },
];

const isActive = (sortingField: SortField, buttonField: SortField): boolean => {
    return sortingField === buttonField;
};

const toggleSortOrder = (sortOrder: SortOrder): SortOrder => {
    return sortOrder === "descending" ? "ascending" : "descending";
};

const getActiveCategory = (sortingField: SortField): Category => {
    const category = categories.find((cat) => cat.field === sortingField);
    if (!category) {
        throw new Error(`Invalid sorting field: ${sortingField}`);
    }
    return category;
};

const SortMenu = (): JSX.Element => {
    const { field: sortByField, order: sortOrder, setSortField, setSortOrder } = useSortSettingsStore();

    const switchOptions: SwitchOption[] = categories.map(c => ({
        label: c.title,
        value: c.field
    }));

    const activeCategory = getActiveCategory(sortByField);

    return (
        <>
            {/* Mobile View */}
            <div className="flex md:hidden">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            variant="circular"
                        >
                            <ArrowDownUp size={32} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56"
                        sideOffset={15}>
                        <DropdownMenuLabel>Sorting method</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {categories.map(category => (
                            <DropdownMenuCheckboxItem
                                key={category.field}
                                onSelect={(e) => e.preventDefault()}
                                checked={isActive(sortByField, category.field)}
                                onCheckedChange={() => setSortField(category.field)}
                            >
                                <DropdownIconStart icon={category.icon} />
                                {category.title}
                            </DropdownMenuCheckboxItem>
                        ))}
                        <DropdownMenuLabel>Direction</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(['ascending', 'descending'] as const).map((direction) => (
                            <DropdownMenuCheckboxItem
                                key={`${direction}_sort`}
                                checked={sortOrder === direction}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={() => setSortOrder(direction)}
                            >
                                <DropdownIconStart
                                    icon={activeCategory.sorting_icons[direction]}
                                />
                                {activeCategory.sorting_labels[direction]}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex h-full w-fit">
                <FancySwitch
                    options={switchOptions}
                    setSelectedOption={setSortField}
                    selectedOption={sortByField}
                    roundedClass="rounded-l-full"
                >
                    <Button
                        className="rounded-r-full"
                        onClick={() => setSortOrder(toggleSortOrder(sortOrder))}
                    >
                        {activeCategory.sorting_icons[sortOrder]}
                    </Button>
                </FancySwitch>
            </div>
        </>
    );
};

export default SortMenu;