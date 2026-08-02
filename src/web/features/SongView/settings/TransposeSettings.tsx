import { RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  canResetKeyAndCapo: boolean;
  resetKeyAndCapo: () => void;
}

const TransposeSettings: React.FC<TransposeSettingsProps> = ({
  soundingKeyIndex,
  setSoundingKeyIndex,
  canResetKeyAndCapo,
  resetKeyAndCapo,
}) => {
  return (
    <div className="flex items-center h-full">
      <div className="hidden xl:block h-full">
        <TransposeButtons
          selected={soundingKeyIndex}
          onChange={setSoundingKeyIndex}
          canResetKeyAndCapo={canResetKeyAndCapo}
          onReset={resetKeyAndCapo}
        />
      </div>

      <div className="xl:hidden h-full">
        <TransposeDropdown
          selected={soundingKeyIndex}
          onChange={setSoundingKeyIndex}
          canResetKeyAndCapo={canResetKeyAndCapo}
          onReset={resetKeyAndCapo}
        />
      </div>
    </div>
  );
};

interface TransposeButtonsProps {
  selected: number;
  onChange: (index: number) => void;
  canResetKeyAndCapo: boolean;
  onReset: () => void;
  vertical?: boolean;
}

const TransposeButtons: React.FC<TransposeButtonsProps> = ({
  selected,
  onChange,
  canResetKeyAndCapo,
  onReset,
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
    >
      <button
        type="button"
        onClick={onReset}
        disabled={!canResetKeyAndCapo}
        className="relative z-10 flex size-10 shrink-0 items-center justify-center border-l border-primary/15 text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35 dark:border-primary/25 dark:hover:bg-primary/15"
        title={
          canResetKeyAndCapo
            ? "Reset key and capo to the original song settings"
            : "Key and capo are already at their original settings"
        }
        aria-label="Reset key and capo to original values"
      >
        <RotateCcw className="size-4" />
      </button>
    </FancySwitch>
  );
};

interface TransposeDropdownProps {
  selected: number;
  onChange: (index: number) => void;
  canResetKeyAndCapo: boolean;
  onReset: () => void;
}

const TransposeDropdown: React.FC<TransposeDropdownProps> = ({
  selected,
  onChange,
  canResetKeyAndCapo,
  onReset,
}) => {
  return (
    <>
      {/* Desktop View */}
      <div className="hidden xl:flex h-full">
        <TransposeButtons
          selected={selected}
          onChange={onChange}
          canResetKeyAndCapo={canResetKeyAndCapo}
          onReset={onReset}
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
              selected={selected}
              onChange={onChange}
              canResetKeyAndCapo={canResetKeyAndCapo}
              onReset={onReset}
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
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canResetKeyAndCapo}
              onSelect={() => onReset()}
            >
              <RotateCcw />
              Reset key & capo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default TransposeSettings;
