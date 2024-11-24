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
import { MusicNoteHelper } from './MusicNoteHelper';
import { MusicNote } from "chordproject-parser";
const renderKeys = ["C", "C#", "D", "Es", "E", "F", "F#", "G", "As", "A", "B", "H"];

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

// function findTransposeSteps(originalKey: string, newKey: string): number {
//     const chromaticIndex = (key: string) => CHROMATIC_SCALE[key];
//     const transposeSteps = originalKey && newKey ? (chromaticIndex(newKey) - chromaticIndex(originalKey)) % 12 : 0;
//     return transposeSteps;
// }

function TransposeButtons({ transposeValues, transposeSteps, setTransposeSteps, vertical = false }) {
    return (
        <FancySwitch options={renderKeys.map((k, index) => { return { "label": k, "value": transposeValues[index] } })} selectedOption={transposeSteps} setSelectedOption={key => {setTransposeSteps(key)}} vertical={vertical} roundedClass={"rounded-full"} full={true} />
    )
}

function TransposeSettings({ songOriginalKey, transposeSteps, setTransposeSteps }) {
    // const makeKeySafe = (key) => key ? english2German[key?.replace("m", "")].toLowerCase() : null;
    // const safeSongRenderKey = makeKeySafe(songRenderKey)
    // setTransposeSteps(findTransposeSteps(makeKeySafe(songOriginalKey), safeSongRenderKey));
    const { ref, isComponentVisible, setIsComponentVisible } = useComponentVisible(false);
    const originalKeyIndex = MusicNoteHelper.semiTonesBetween(MusicNote.parse("C"), songOriginalKey.note);
    const transposeValues = [...Array(12).keys()].map(v => v - originalKeyIndex);
    return (<>
        <div className='hidden xl:flex h-full'>
            <TransposeButtons transposeValues={transposeValues} transposeSteps={transposeSteps} setTransposeSteps={setTransposeSteps} />
        </div>
        <div className='xl:hidden max-sm:hidden'>
            <Button size="icon" variant="circular" onClick={() => { setIsComponentVisible(!isComponentVisible) }}><ArrowUpDown /></Button>
            <div className={"absolute top-12 w-fit left-0 "} ref={ref}>
                {isComponentVisible &&
                    <ToolbarBase showToolbar={isComponentVisible}>
                        <div className="w-full flex justify-center p-0 h-full">
                            <TransposeButtons transposeValues={transposeValues} transposeSteps={transposeSteps} setTransposeSteps={setTransposeSteps} />
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
                    {renderKeys.map((k, index) => (
                        <DropdownMenuCheckboxItem checked={transposeSteps == index - originalKeyIndex} key={k} onCheckedChange={() => setTransposeSteps(index - originalKeyIndex)}>{k}</DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div >
    </>

    )
}

export default TransposeSettings;