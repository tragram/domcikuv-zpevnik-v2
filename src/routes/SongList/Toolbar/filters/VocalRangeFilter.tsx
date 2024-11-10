
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Music } from "lucide-react";
import { RangeSlider } from "@/components/ui/slider"

function VocalRangeSlider({ maxRange, vocalRangeFilter, setVocalRangeFilter }) {
    return (
        <RangeSlider
            label="Semitones"
            step={1}
            min={0}
            max={maxRange}
            defaultValue={vocalRangeFilter === "all" ? [0, maxRange] : vocalRangeFilter}
            // formatOptions={{ style: "decimal" }}
            value={vocalRangeFilter === "all" ? [0, maxRange] : vocalRangeFilter}
            className="max-w-md"
            onValueChange={(value) => { setVocalRangeFilter(value) }} />
    )

}

function VocalRangeFilter({ maxRange, vocalRangeFilter, setVocalRangeFilter, iconOnly }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="circular" className=" shadow-none outline-0 font-bold rounded-l-none">
                    <Music />{iconOnly ? "Range" : ""}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Vocal range filter slider" className="w-80">
                <DropdownMenuItem key="slider" onSelect={e => e.preventDefault()} >
                    <VocalRangeSlider maxRange={maxRange} vocalRangeFilter={vocalRangeFilter} setVocalRangeFilter={setVocalRangeFilter} />
                </DropdownMenuItem>
                <DropdownMenuItem key="reset" onClick={() => setVocalRangeFilter("all")}>Reset</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function VocalRangeDropdownSection(maxRange: number, vocalRangeFilter, setVocalRangeFilter) {
    return (<>
        <DropdownMenuLabel>Select song range</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem key="slider" onSelect={e => e.preventDefault()} >
            <VocalRangeSlider maxRange={maxRange} vocalRangeFilter={vocalRangeFilter} setVocalRangeFilter={(range) => setVocalRangeFilter(range)} />
        </DropdownMenuItem>
        <DropdownMenuItem key="reset" onClick={() => setVocalRangeFilter("all")}>
            Reset
        </DropdownMenuItem>
    </>
    )
}

export { VocalRangeFilter, VocalRangeDropdownSection };