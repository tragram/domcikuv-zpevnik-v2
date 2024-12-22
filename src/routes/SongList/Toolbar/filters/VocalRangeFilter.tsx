
import { Button } from "@/components/ui/button";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { RangeSlider } from "@/components/ui/slider";
import { Music } from "lucide-react";

export type VocalRangeValue = "all" | [number, number];

interface VocalRangeSliderProps {
    maxRange: number;
    vocalRangeFilter: VocalRangeValue;
    setVocalRangeFilter: (range: VocalRangeValue) => void;
}

interface VocalRangeFilterProps extends VocalRangeSliderProps {
    iconOnly: boolean;
}

const VocalRangeSlider = ({ 
    maxRange, 
    vocalRangeFilter, 
    setVocalRangeFilter 
}: VocalRangeSliderProps): JSX.Element => {
    const currentValue = vocalRangeFilter === "all" ? [0, maxRange] : vocalRangeFilter;

    return (
        <RangeSlider
            label="Semitones"
            step={1}
            min={0}
            max={maxRange}
            defaultValue={currentValue}
            value={currentValue}
            className="max-w-md"
            onValueChange={(value) => setVocalRangeFilter(value as [number, number])}
        />
    );
};

export const VocalRangeFilter = ({ 
    maxRange, 
    vocalRangeFilter, 
    setVocalRangeFilter, 
    iconOnly 
}: VocalRangeFilterProps): JSX.Element => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button 
                    variant="circular" 
                    className="shadow-none outline-0 font-bold rounded-l-none"
                >
                    <Music />
                    {!iconOnly && "Range"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
                aria-label="Vocal range filter slider" 
                className="w-80"
            >
                <DropdownMenuItem 
                    key="slider" 
                    onSelect={(e) => e.preventDefault()}
                >
                    <VocalRangeSlider 
                        maxRange={maxRange}
                        vocalRangeFilter={vocalRangeFilter}
                        setVocalRangeFilter={setVocalRangeFilter}
                    />
                </DropdownMenuItem>
                <DropdownMenuItem 
                    key="reset" 
                    onClick={() => setVocalRangeFilter("all")}
                >
                    Reset
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export const VocalRangeDropdownSection = (
    maxRange: number,
    vocalRangeFilter: VocalRangeValue,
    setVocalRangeFilter: (range: VocalRangeValue) => void
): JSX.Element => {
    return (
        <>
            <DropdownMenuLabel>Select song range</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
                key="slider" 
                onSelect={(e) => e.preventDefault()}
            >
                <VocalRangeSlider 
                    maxRange={maxRange}
                    vocalRangeFilter={vocalRangeFilter}
                    setVocalRangeFilter={setVocalRangeFilter}
                />
            </DropdownMenuItem>
            <DropdownMenuItem 
                key="reset" 
                onClick={() => setVocalRangeFilter("all")}
                onSelect={(e) => e.preventDefault()}
            >
                Reset
            </DropdownMenuItem>
        </>
    );
};