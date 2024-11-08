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
    "C": "C",
    "C#": "C#",
    "D": "D",
    "Es": "Eb",
    "E": "E",
    "F": "F",
    "F#": "F#",
    "G": "G",
    "As": "Ab",
    "A": "A",
    "B": "Bb",
    "H": "B",
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


function useComponentVisible(initialIsVisible) {
    const [isComponentVisible, setIsComponentVisible] = useState(initialIsVisible);
    const ref = useRef(null);

    const handleClickOutside = (event) => {
        console.log("click outside")
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

function TransposeButtons({ songRenderKey, setSongRenderKey, vertical = false }) {
    return (
        <FancySwitch options={renderKeys} selectedOption={songRenderKey.toUpperCase()} setSelectedOption={key => setSongRenderKey(german2English[key])} vertical={vertical} roundedClass={"rounded-full"} full={true} />
    )
}

function TransposeSettings({ songRenderKey, setSongRenderKey }) {
    const safeSongRenderKey = english2German[songRenderKey?.replace("m", "")].toLowerCase()
    // const [visibleTranspose, setVisibleTranspose] = useState(false);
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
                <DropdownMenuTrigger>
                    <Button size="icon" variant="circular" onClick={() => { setIsComponentVisible(!isComponentVisible) }}><ArrowUpDown /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-12">
                    {renderKeys.map(k => (
                        <DropdownMenuCheckboxItem checked={songRenderKey.toUpperCase() == k} onCheckedChange={()=>setSongRenderKey(german2English[k])}>{k}</DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div >
    </>

    )
}

export default TransposeSettings;