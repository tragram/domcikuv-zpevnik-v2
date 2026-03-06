import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useMemo } from "react";
import { Note, Key } from "~/types/musicTypes";
import TransposeIcon from "./transpose_icon";
import FancySwitch from "~/components/FancySwitch";

const RENDER_KEYS = [
  "C",
  "C#",
  "D",
  "Es",
  "E",
  "F",
  "F#",
  "G",
  "As",
  "A",
  "B",
  "H",
];

interface TransposeSettingsProps {
  originalKey: Key | undefined;
  transposeSteps: number;
  setTransposeSteps: (value: number) => void;
}

const TransposeSettings: React.FC<TransposeSettingsProps> = ({
  originalKey,
  transposeSteps,
  setTransposeSteps,
}) => {
  const originalKeyIndex = originalKey?.note
    ? new Note("C").semitonesBetween(originalKey?.note)
    : 0;

  const transposeValues = useMemo(
    () => [...Array(12).keys()].map((v) => v - originalKeyIndex),
    [originalKeyIndex],
  );

  return (
    <div className="flex items-center h-full">
      <div className="hidden xl:block h-full">
        <TransposeButtons
          values={transposeValues}
          selected={transposeSteps}
          onChange={setTransposeSteps}
        />
      </div>

      <div className="xl:hidden h-full">
        <TransposeDropdown
          values={transposeValues}
          selected={transposeSteps}
          onChange={setTransposeSteps}
        />
      </div>
    </div>
  );
};

interface TransposeButtonsProps {
  values: number[];
  selected: number;
  onChange: (steps: number) => void;
  vertical?: boolean;
}

const TransposeButtons: React.FC<TransposeButtonsProps> = ({
  values,
  selected,
  onChange,
  vertical = false,
}) => {
  return (
    <FancySwitch
      options={RENDER_KEYS.map((k, index) => ({
        label: k,
        value: values[index],
      }))}
      selectedOption={selected}
      setSelectedOption={onChange}
      vertical={vertical}
      roundedClass={"rounded-full"}
      full={true}
    />
  );
};

interface TransposeDropdownProps {
  values: number[];
  selected: number;
  onChange: (steps: number) => void;
}

const TransposeDropdown: React.FC<TransposeDropdownProps> = ({
  values,
  selected,
  onChange,
}) => {
  return (
    <>
      {/* Desktop View */}
      <div className="hidden xl:flex h-full">
        <TransposeButtons
          values={values}
          selected={selected}
          onChange={onChange}
        />
      </div>

      {/* Tablet View using Popover */}
      <div className="xl:hidden flex max-[600px]:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="circular">
              <TransposeIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={16}
            className="w-fit p-1.5 rounded-full bg-glass/80 dark:bg-glass/30 backdrop-blur-md outline-primary dark:outline-primary/30 outline-2 border-none shadow-lg"
          >
            <TransposeButtons
              values={values}
              selected={selected}
              onChange={onChange}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Mobile View using DropdownMenu */}
      <div className="flex min-[600px]:hidden">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="circular">
              <TransposeIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-12">
            {RENDER_KEYS.map((k, index) => (
              <DropdownMenuCheckboxItem
                checked={selected === values[index]}
                key={k}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => onChange(values[index])}
              >
                {k}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default TransposeSettings;
