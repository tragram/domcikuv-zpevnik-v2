import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react"
import { Guitar, Repeat, Strikethrough, Check, ReceiptText, Columns2 } from "lucide-react"
import LoopNoteIconSVG from '/loop_note.svg'


function SpaceSavingSettings({ chordsHidden, setChordsHidden, repeatParts, setRepeatParts, repeatVerseChords, setRepeatVerseChords,twoColumns,settwoColumns }) {
    return (
        <>
            <div className='hidden xs:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "ghost" : "solid"}><Guitar /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatParts(!repeatParts) }} variant={repeatParts ? "solid" : "ghost"}><Repeat /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} variant={repeatVerseChords ? "solid" : "ghost"}>{LoopNoteIcon()}</Button>
                    <Button color="primary" isIconOnly onClick={() => { settwoColumns(!twoColumns) }} variant={twoColumns ? "solid" : "ghost"}><Columns2 /></Button>
                </ButtonGroup>
            </div>
            <div className='flex xs:hidden'>
                <Dropdown closeOnSelect={false} disableAnimation>
                    <DropdownTrigger>
                        <Button
                            variant="ghost" color="primary" isIconOnly
                        >
                            <Strikethrough />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Change font size" >
                        <DropdownItem startContent={<Guitar />} key="hide_chords" onClick={() => { setChordsHidden(!chordsHidden) }} endContent={chordsHidden ? <Check /> : ""}>
                            Hide chords
                        </DropdownItem>
                        <DropdownItem startContent={<Repeat />} key="hide_repeat_parts" onClick={() => { setRepeatParts(!repeatParts) }} endContent={!repeatParts ? <Check /> : ""}>
                            Hide repeated parts
                        </DropdownItem>
                        <DropdownItem startContent={LoopNoteIcon()} key="hide_repeated_chords" onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} endContent={!repeatVerseChords ? <Check /> : ""}>
                            Hide chords in repeated parts
                        </DropdownItem>
                        <DropdownItem startContent={<Columns2 />} key="show_two_columns" onClick={() => { settwoColumns(!twoColumns) }} endContent={!twoColumns ? <Check /> : ""}>
                            Show in two columns
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

export default SpaceSavingSettings;