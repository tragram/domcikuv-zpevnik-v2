import { Minus, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

const MAX_CAPO = 11;

interface CapoControlProps {
  capo: number;
  // Sets the cosmetic capo note. It changes nothing else — not the chords, the
  // sounding key, or the range.
  setCapo: (capo: number) => void;
  // The song's original ("main") capo, used for the reset hint.
  originalCapo: number;
  // When false (e.g. logged-out), just shows the capo as static text.
  editable: boolean;
  className?: string;
}

/**
 * The "Capo: N" shown in the song heading. For logged-in users it's a button
 * that opens a small +/- stepper; otherwise it's plain text. The capo is purely
 * a cosmetic note the user keeps for themselves — changing it never re-spells
 * chords or moves the key.
 */
const CapoControl: React.FC<CapoControlProps> = ({
  capo,
  setCapo,
  originalCapo,
  editable,
  className,
}) => {
  const label = `Capo: ${capo}`;
  const clamp = (v: number) => Math.min(MAX_CAPO, Math.max(0, v));

  if (!editable) return <span className={className}>{label}</span>;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "cursor-pointer underline-offset-4 hover:underline",
            className,
          )}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={12}
        className="w-fit p-3 rounded-2xl bg-glass/80 dark:bg-glass/30 backdrop-blur-md outline-primary dark:outline-primary/30 outline-2 border-none shadow-lg"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-medium">Capo</span>
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="circular"
              disabled={capo <= 0}
              onClick={() => setCapo(clamp(capo - 1))}
            >
              <Minus />
            </Button>
            <span className="w-6 text-center text-lg font-semibold tabular-nums">
              {capo}
            </span>
            <Button
              size="icon"
              variant="circular"
              disabled={capo >= MAX_CAPO}
              onClick={() => setCapo(clamp(capo + 1))}
            >
              <Plus />
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setCapo(originalCapo)}
            className={cn(
              "text-xs opacity-70 underline-offset-2 hover:underline hover:opacity-100",
              capo === originalCapo && "invisible",
            )}
          >
            Reset to original ({originalCapo})
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CapoControl;
