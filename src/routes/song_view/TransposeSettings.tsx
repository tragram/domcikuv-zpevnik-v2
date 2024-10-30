import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
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

function TransposeButtons({ songRenderKey, setSongRenderKey }) {
    function getKeyIndex(key) {
        return renderKeys.map(x => x.toLowerCase()).indexOf(key.toLowerCase());
    }
    return (<>
        <div className='hidden md:flex'>
            <ButtonGroup>
                {renderKeys.map((chord) => (
                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                        name="transpose_selection" onClick={() => { setSongRenderKey(german2English[(chord)]) }} variant={songRenderKey && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                ))
                }
            </ButtonGroup>
        </div>
        <div className='md:hidden'>
            <ButtonGroup>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(german2English[(renderKeys[(getKeyIndex(songRenderKey) + 11) % 12])])} variant='ghost'>-</Button>
                <Button color="primary" isIconOnly onClick={() => setSongRenderKey(german2English[(renderKeys[(getKeyIndex(songRenderKey) + 1) % 12])])} variant='ghost'>+</Button>
            </ButtonGroup>
        </div>
    </>)
}

function TransposeSettings({ songRenderKey, setSongRenderKey }) {
    return (<>
        <div className='hidden lg:flex'>
            <ButtonGroup>
                {renderKeys.map((chord) => (
                    <Button className="w-1/12" color="primary" isIconOnly key={`transpose_selection_${chord}`}
                        name="transpose_selection" onClick={() => { setSongRenderKey(german2English[(chord)]) }} variant={songRenderKey && songRenderKey.toLowerCase() == chord.toLowerCase() ? "solid" : "ghost"} >{chord}</Button>
                ))
                }
            </ButtonGroup>
        </div>
        <div className='lg:hidden'>
            <Dropdown closeOnSelect={false} disableAnimation>
                <DropdownTrigger>
                    <Button
                        variant="ghost" color="primary" isIconOnly
                    >
                        <ArrowUpDown />
                    </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Tranpose chords">
                    <DropdownItem>
                        <TransposeButtons setSongRenderKey={setSongRenderKey} songRenderKey={songRenderKey} />
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>
        </div>
    </>

    )
}

export default TransposeSettings;