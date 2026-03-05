import {
  ArrowDown01,
  ArrowDown10,
  ArrowDownAZ,
  ArrowDownNarrowWide,
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowDownZA,
  AudioLines,
  CalendarPlus,
  MicVocal,
  Music,
} from "lucide-react";
import type { JSX, ReactElement } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import FancySwitch from "~/components/FancySwitch";
import { RichItem } from "~/components/RichDropdown";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SortField, SortOrder, SortSettings } from "~/types/types";

interface SortSettingsState extends SortSettings {
  setSortOrder: (sortOrder: SortOrder) => void;
  setSortField: (sortField: SortField) => void;
}

export const useSortSettingsStore = create<SortSettingsState>()(
  persist(
    (set) => ({
      order: "descending" as SortOrder,
      field: "dateAdded" as SortField,
      setSortOrder: (sortOrder: SortOrder) =>
        set({
          order: sortOrder,
        }),
      setSortField: (sortField: SortField) =>
        set({
          field: sortField,
        }),
    }),
    {
      name: "sort-settings-store",
    },
  ),
);

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
  defaultOrder: SortOrder;
}

interface SwitchOption {
  label: string;
  value: SortField;
}

const letterSortingIcons: SortingIcons = {
  ascending: <ArrowDownAZ />,
  descending: <ArrowDownZA />,
};

const numberSortingIcons: SortingIcons = {
  ascending: <ArrowDown01 />,
  descending: <ArrowDown10 />,
};

const rangeSortingIcons: SortingIcons = {
  ascending: <ArrowDownNarrowWide />,
  descending: <ArrowDownWideNarrow />,
};

const categories: Category[] = [
  {
    field: "title",
    title: "Title",
    icon: <AudioLines />,
    sorting_icons: letterSortingIcons,
    sorting_labels: {
      ascending: "Ascending",
      descending: "Descending",
    },
    defaultOrder: "ascending",
  },
  {
    field: "artist",
    title: "Artist",
    icon: <MicVocal />,
    sorting_icons: letterSortingIcons,
    sorting_labels: {
      ascending: "Ascending",
      descending: "Descending",
    },
    defaultOrder: "ascending",
  },
  {
    field: "dateAdded",
    title: "Date Added",
    icon: <CalendarPlus />,
    sorting_icons: numberSortingIcons,
    sorting_labels: {
      ascending: "Old → New",
      descending: "New → Old",
    },
    defaultOrder: "descending",
  },
  {
    field: "range",
    title: "Range",
    icon: <Music />,
    sorting_icons: rangeSortingIcons,
    sorting_labels: {
      ascending: "XS → XXL",
      descending: "XXL → XS",
    },
    defaultOrder: "ascending",
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

const getDefaultOrderForField = (field: SortField): SortOrder => {
  const category = categories.find((cat) => cat.field === field);
  return category?.defaultOrder || "ascending";
};

const SortMenu = (): JSX.Element => {
  const {
    field: sortByField,
    order: sortOrder,
    setSortField,
    setSortOrder,
  } = useSortSettingsStore();

  const switchOptions: SwitchOption[] = categories.map((c) => ({
    label: c.title,
    value: c.field,
  }));

  const activeCategory = getActiveCategory(sortByField);

  const handleFieldChange = (newField: SortField) => {
    if (newField !== sortByField) {
      setSortField(newField);
      setSortOrder(getDefaultOrderForField(newField));
    }
  };

  return (
    <>
      <div className="flex md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular">
              <ArrowDownUp size={32} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="m-2 w-[calc(100dvw-1rem)] max-w-56">
            <RichItem.Header>Sorting method</RichItem.Header>
            <DropdownMenuSeparator />

            {categories.map((category) => (
              <DropdownMenuCheckboxItem
                key={category.field}
                onSelect={(e) => e.preventDefault()}
                checked={isActive(sortByField, category.field)}
                onCheckedChange={() => handleFieldChange(category.field)}
                className="py-2"
              >
                <RichItem.Shell>
                  <RichItem.Icon>{category.icon}</RichItem.Icon>
                  <RichItem.Body title={category.title} />
                </RichItem.Shell>
              </DropdownMenuCheckboxItem>
            ))}

            <RichItem.Header>Direction</RichItem.Header>
            <DropdownMenuSeparator />

            {(["ascending", "descending"] as const).map((direction) => (
              <DropdownMenuCheckboxItem
                key={`${direction}_sort`}
                checked={sortOrder === direction}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => setSortOrder(direction)}
                className="py-2"
              >
                <RichItem.Shell>
                  <RichItem.Icon>
                    {activeCategory.sorting_icons[direction]}
                  </RichItem.Icon>
                  <RichItem.Body
                    title={activeCategory.sorting_labels[direction]}
                  />
                </RichItem.Shell>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden md:flex h-full w-fit">
        <FancySwitch
          options={switchOptions}
          setSelectedOption={handleFieldChange}
          selectedOption={sortByField}
          roundedClass="rounded-l-full"
        >
          <Button
            className="rounded-r-full hover:bg-transparent hover:text-primary hover:dark:bg-transparent"
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
