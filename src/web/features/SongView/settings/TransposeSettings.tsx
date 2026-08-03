import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
  const [isTabletPickerOpen, setIsTabletPickerOpen] = useState(false);
  const tabletPickerRef = useRef<HTMLDivElement>(null);
  const tabletTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isTabletPickerOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (
        !tabletPickerRef.current?.contains(target) &&
        !tabletTriggerRef.current?.contains(target)
      ) {
        setIsTabletPickerOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsTabletPickerOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isTabletPickerOpen]);

  const selectTabletKey = (index: number) => {
    onChange(index);
    setIsTabletPickerOpen(false);
  };

  const resetTabletKeyAndCapo = () => {
    onReset();
    setIsTabletPickerOpen(false);
  };

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
        <Button
          ref={tabletTriggerRef}
          size="icon"
          variant="circular"
          aria-expanded={isTabletPickerOpen}
          aria-haspopup="dialog"
          aria-controls="tablet-transpose-picker"
          onClick={() => setIsTabletPickerOpen((open) => !open)}
        >
          <TransposeIcon />
        </Button>
        {isTabletPickerOpen && (
          <div id="tablet-transpose-picker-container" className="fixed left-0 w-full top-16 flex justify-end">
            <div
              ref={tabletPickerRef}
              id="tablet-transpose-picker"
              role="dialog"
              aria-label="Transpose key"
              className="z-50 w-fit rounded-full border-none bg-glass/80 p-1.5 shadow-lg outline-2 outline-primary backdrop-blur-md dark:bg-glass/30 dark:outline-primary/30"
            >
              <TransposeButtons
                selected={selected}
                onChange={selectTabletKey}
                canResetKeyAndCapo={canResetKeyAndCapo}
                onReset={resetTabletKeyAndCapo}
              />
            </div>
          </div>
        )}
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
