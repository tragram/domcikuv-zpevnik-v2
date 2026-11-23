import { RotateCcw } from "lucide-react";
import { songPanelClassName, toolbarPanelPlacement } from "../components/songPanel";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import TransposeIcon from "./transpose_icon";
import FancySwitch from "~/components/FancySwitch";

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
      <div className="hidden min-[1400px]:block h-full">
        <TransposeButtons
          selected={soundingKeyIndex}
          onChange={setSoundingKeyIndex}
          canResetKeyAndCapo={canResetKeyAndCapo}
          onReset={resetKeyAndCapo}
        />
      </div>

      <div className="min-[1400px]:hidden h-full">
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
        className="relative z-10 flex size-10 shrink-0 items-center justify-center border-l border-border text-primary transition-colors hover:bg-control-hover disabled:cursor-not-allowed disabled:opacity-35"
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
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="circular" aria-label="Choose song key">
          <TransposeIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={typeof document === "undefined" ? undefined : document.fullscreenElement}
        {...toolbarPanelPlacement}
        aria-label="Choose song key"
        className={`${songPanelClassName} w-80 max-sm:w-[calc(100dvw-2rem)] max-w-[calc(100vw-2rem)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto text-sm font-normal`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Song key">
            {RENDER_KEYS.map((key, index) => (
              <button
                key={key}
                type="button"
                aria-pressed={selected === index}
                onClick={() => onChange(index)}
                className={
                  "min-h-11 rounded-full border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary " +
                  (selected === index
                    ? "border-control-border bg-primary text-primary-foreground hover:bg-control-active-hover"
                    : "border-control-border bg-control-surface text-primary hover:bg-control-hover")
                }
              >{key}</button>
            ))}
          </div>
          <div className="border-t border-control-border pt-3">
            <button
              type="button"
              disabled={!canResetKeyAndCapo}
              onClick={() => onReset()}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-control-border bg-control-surface text-xs text-primary hover:bg-control-hover disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary"
            >
              <RotateCcw className="size-3.5" />
              Reset key & capo
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TransposeSettings;
