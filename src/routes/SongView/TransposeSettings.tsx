// import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FancySwitch from "@/components/ui/fancy-switch";
import { ArrowUpDown } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import ToolbarBase from "@/components/ui/toolbar-base";
import { useEffect, useRef, useState } from "react";

const renderKeys = ["C", "C#", "D", "Es", "E", "F", "F#", "G", "As", "A", "B", "H"]

const german2English = {
    "c": "C",
    "c#": "C#",
    "d": "D",
    "es": "Eb",
    "e": "E",
    "f": "F",
    "f#": "F#",
    "g": "G",
    "as": "Ab",
    "a": "A",
    "b": "Bb",
    "h": "B",
}

const english2German = {
    "C": "C",
    "C#": "C#",
    "D": "D",
    "Eb": "Es",
    "E": "E",
    "F": "F",
    "F#": "F#",
    "G": "G",
    "Ab": "As",
    "A": "A",
    "Bb": "B",
    "B": "H",
}

// TODO: unify with preparse_ChordPro
const CHROMATIC_SCALE: { [key: string]: number } = {
    "c": 0, "c#": 1, "db": 1, "des": 1, "d": 2, "d#": 3, "eb": 3, "es": 3, "e": 4, "f": 5, "f#": 6, "gb": 6, "g": 7, "g#": 8, "ab": 8, "as": 8, "a": 9, "a#": 10, "b": 10, "h": 11
};

function useComponentVisible(initialIsVisible) {
    const [isComponentVisible, setIsComponentVisible] = useState(initialIsVisible);
    const ref = useRef(null);

    const handleClickOutside = (event) => {
        if (ref.current && !ref.current.contains(event.target)) {
            setIsComponentVisible(false);
        }
    };

    useEffect(() => {
        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        };
    }, []);

    return { ref, isComponentVisible, setIsComponentVisible };
}

function findTransposeSteps(originalKey: string, newKey: string): number {
    const chromaticIndex = (key: string) => CHROMATIC_SCALE[key];
    const transposeSteps = originalKey && newKey ? (chromaticIndex(newKey) - chromaticIndex(originalKey)) % 12 : 0;
    return transposeSteps;
}

function TransposeButtons({ songRenderKey, setSongRenderKey, vertical = false }) {
    return (
        <FancySwitch options={renderKeys.map(k => { return { "label": k, "value": k.toLowerCase() } })} selectedOption={songRenderKey.toLowerCase()} setSelectedOption={key => setSongRenderKey(german2English[key])} vertical={vertical} roundedClass={"rounded-full"} full={true} />
    )
}

function TransposeSettings({ songOriginalKey, songRenderKey, setSongRenderKey, setTransposeSteps }) {
    const makeKeySafe = (key) => key ? english2German[key?.replace("m", "")].toLowerCase() : null;
    const safeSongRenderKey = makeKeySafe(songRenderKey)
    setTransposeSteps(findTransposeSteps(makeKeySafe(songOriginalKey), safeSongRenderKey));
    const { ref, isComponentVisible, setIsComponentVisible } = useComponentVisible(false);
    return (<>
        <div className='hidden xl:flex h-full'>
            <TransposeButtons songRenderKey={safeSongRenderKey} setSongRenderKey={setSongRenderKey} />
        </div>
        <div className='xl:hidden max-sm:hidden'>
            <Button size="icon" variant="circular" onClick={() => { setIsComponentVisible(!isComponentVisible) }}><ArrowUpDown /></Button>
            <div className={"absolute top-12 w-fit left-0 "} ref={ref}>
                {isComponentVisible &&
                    <ToolbarBase showToolbar={isComponentVisible}>
                        <div className="w-full flex justify-center p-0 h-full">
                            <TransposeButtons songRenderKey={safeSongRenderKey} setSongRenderKey={setSongRenderKey} />
                        </div>
                    </ToolbarBase>}
            </div>
        </div >
        <div className='sm:hidden xl:hidden flex'>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="circular" onClick={() => { setIsComponentVisible(!isComponentVisible) }}><ArrowUpDown /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-12">
                    {renderKeys.map(k => (
                        <DropdownMenuCheckboxItem checked={songRenderKey.toUpperCase() == k} onCheckedChange={() => setSongRenderKey(german2English[k])}>{k}</DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div >
    </>

    )
}

export default TransposeSettings;