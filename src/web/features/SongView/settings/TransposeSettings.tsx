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
import TransposeIcon from "./transpose_icon";
import FancySwitch from "~/components/FancySwitch";
import { CompactItem } from "~/components/RichDropdown";

// Chromatic keys from C; the array index is the semitone offset from C and is
// used directly as the (0..11) sounding-key value.
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
  // Current sounding key as a 0..11 index (what the user hears / sings).
  soundingKeyIndex: number;
  setSoundingKeyIndex: (index: number) => void;
}

const TransposeSettings: React.FC<TransposeSettingsProps> = ({
  soundingKeyIndex,
  setSoundingKeyIndex,
}) => {
  return (
    <div className="flex items-center h-full">
      <div className="hidden xl:block h-full">
        <TransposeButtons
          selected={soundingKeyIndex}
          onChange={setSoundingKeyIndex}
        />
      </div>

      <div className="xl:hidden h-full">
        <TransposeDropdown
          selected={soundingKeyIndex}
          onChange={setSoundingKeyIndex}
        />
      </div>
    </div>
  );
};

interface TransposeButtonsProps {
  selected: number;
  onChange: (index: number) => void;
  vertical?: boolean;
}

const TransposeButtons: React.FC<TransposeButtonsProps> = ({
  selected,
  onChange,
  vertical = false,
}) => {
  return (
    <FancySwitch
      options={RENDER_KEYS.map((k, index) => ({
        label: k,
        value: index,
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
  selected: number;
  onChange: (index: number) => void;
}

const TransposeDropdown: React.FC<TransposeDropdownProps> = ({
  selected,
  onChange,
}) => {
  return (
    <>
      {/* Desktop View */}
      <div className="hidden xl:flex h-full">
        <TransposeButtons selected={selected} onChange={onChange} />
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
            <TransposeButtons selected={selected} onChange={onChange} />
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
          <DropdownMenuContent className="w-fit min-w-16">
            {RENDER_KEYS.map((k, index) => (
              <DropdownMenuCheckboxItem
                checked={selected === index}
                key={k}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => onChange(index)}
              >
                <CompactItem.Shell>
                  <CompactItem.Body title={k} />
                </CompactItem.Shell>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default TransposeSettings;
