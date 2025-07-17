import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/shadcn-ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/shadcn-ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/shadcn-ui/popover";

interface SelectOrEditListProps {
  options: string[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholderCollapsed?: string;
  placeholderSearch?: string;
  noOptionsFoundText?: string;
  addNewText?: string;
  className?: string;
}

export default function SelectOrEditList({
  options: initialOptions,
  value,
  onValueChange,
  placeholderCollapsed = "Select an option...",
  placeholderSearch = "Search or type new option...",
  noOptionsFoundText = "No options found.",
  addNewText = "Add new option",
  className,
}: SelectOrEditListProps) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState(initialOptions);
  const [searchValue, setSearchValue] = React.useState("");

  const handleSelect = (selectedValue: string) => {
    if (selectedValue === value) {
      onValueChange?.("");
    } else {
      onValueChange?.(selectedValue);
    }
    setOpen(false);
    setSearchValue("");
  };

  const handleAddNew = () => {
    if (searchValue.trim() && !options.includes(searchValue.trim())) {
      const newOption = searchValue.trim();
      setOptions((prev) => [...prev, newOption]);
      onValueChange?.(newOption);
      setOpen(false);
      setSearchValue("");
    }
  };

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchValue.toLowerCase())
  );

  const showAddNew =
    searchValue.trim() &&
    !options.some(
      (option) => option.toLowerCase() === searchValue.toLowerCase()
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between focus:outline-none", className)}
        >
          {value || placeholderCollapsed}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-30" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder={placeholderSearch}
            value={searchValue}
            onValueChange={setSearchValue}
            className="focus:outline-none focus:ring-0"
          />
          <CommandList>
            {filteredOptions.length === 0 && !showAddNew && (
              <CommandEmpty>{noOptionsFoundText}</CommandEmpty>
            )}

            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showAddNew && (
              <CommandGroup>
                <CommandItem onSelect={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  {addNewText}: "{searchValue}"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
