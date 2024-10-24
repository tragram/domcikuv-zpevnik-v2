import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react"
import { Guitar, Repeat, Strikethrough, Check, ReceiptText } from "lucide-react"

function SpaceSavingSettings({ chordsHidden, setChordsHidden, repeatChorus, setRepeatChorus, repeatVerseChords, setRepeatVerseChords }) {
    return (
        <>
            <div className='hidden xs:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setChordsHidden(!chordsHidden) }} variant={chordsHidden ? "ghost" : "solid"}><Guitar /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatChorus(!repeatChorus) }} variant={repeatChorus ? "solid" : "ghost"}><Repeat /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} variant={repeatVerseChords ? "solid" : "ghost"}><Strikethrough /></Button>
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
                        <DropdownItem startContent={<Repeat />} key="hide_repeat_chorus" onClick={() => { setRepeatChorus(!repeatChorus) }} endContent={!repeatChorus ? <Check /> : ""}>
                            Hide repeated chorus
                        </DropdownItem>
                        <DropdownItem startContent={<ReceiptText />} key="hide_verse_chords" onClick={() => { setRepeatVerseChords(!repeatVerseChords) }} endContent={!repeatVerseChords ? <Check /> : ""}>
                            Hide chords in repeated verses
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

export default SpaceSavingSettings;