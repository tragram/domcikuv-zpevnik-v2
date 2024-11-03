// import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import FancySwitch from "@/components/ui/fancy-switch";
import { ArrowUpDown } from "lucide-react";

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


function TransposeButtons({ songRenderKey, setSongRenderKey, vertical = false }) {
    return (
        <FancySwitch options={renderKeys} selectedOption={songRenderKey.toUpperCase()} setSelectedOption={key => setSongRenderKey(german2English[key])} vertical={vertical}/>
    )
}

function TransposeSettings({ songRenderKey, setSongRenderKey }) {
    const safeSongRenderKey = english2German[songRenderKey?.replace("m", "")].toLowerCase()
    return (<>
        <div className='hidden lg:flex h-full'>
            <TransposeButtons songRenderKey={safeSongRenderKey} setSongRenderKey={setSongRenderKey} />
        </div>
        <div className='lg:hidden'>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="icon" className="rounded-full"><ArrowUpDown /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-12">
                <TransposeButtons songRenderKey={safeSongRenderKey} setSongRenderKey={setSongRenderKey} vertical={true} />
                </DropdownMenuContent>
            </DropdownMenu>
            {/* <Dropdown closeOnSelect={false} disableAnimation>
                <DropdownTrigger>
                    <Button
                        variant="ghost" color="primary" isIconOnly
                    >
                        <ArrowUpDown />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Tranpose chords">
                    <DropdownItem>
                        <TransposeButtons setSongRenderKey={setSongRenderKey} songRenderKey={safeSongRenderKey} />
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown> */}
        </div>
    </>

    )
}

export default TransposeSettings;