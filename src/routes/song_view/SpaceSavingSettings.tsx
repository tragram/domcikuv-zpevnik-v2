import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react"
import { Guitar, Repeat, Strikethrough, Check, ReceiptText, Columns2 } from "lucide-react"
import LoopNoteIconSVG from '/loop_note.svg'
const LoopNoteIcon = () => {
    // return <LoopNoteIconSVG />
    return <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 531.12134 487.28763"
        fill="none"
        stroke="currentColor"
    >
  <g
     transform="matrix(0.1,0,0,-0.1,9.4062996,499.50655)"
     fill="currentColor"
     stroke="none"
     id="g2">
    <path
       d="M 2165,4890 C 1859,4864 1586,4788 1303,4649 688,4347 236,3787 70,3120 19,2918 6,2797 6,2560 6,2404 10,2314 23,2230 71,1922 175,1628 323,1381 564,979 896,671 1303,471 c 299,-147 559,-217 900,-242 128,-10 151,-9 171,4 29,19 37,48 22,79 -10,21 -20,24 -111,30 -388,28 -638,91 -925,234 -450,224 -799,574 -1016,1018 -296,609 -296,1323 0,1932 323,662 946,1115 1691,1229 151,24 470,24 620,1 814,-127 1465,-641 1764,-1393 70,-177 124,-401 137,-563 l 6,-85 -169,168 c -93,92 -177,167 -187,167 -22,0 -66,-44 -66,-67 0,-9 104,-122 232,-250 181,-182 238,-233 258,-233 20,0 76,51 258,233 223,224 245,251 224,283 -15,22 -50,34 -74,25 -13,-5 -95,-82 -183,-170 -107,-108 -162,-156 -167,-148 -4,7 -8,28 -8,47 0,61 -29,231 -60,357 -227,909 -998,1606 -1930,1743 -152,22 -390,31 -525,20 z"
        style={{display:"inline",stroke:"currentColor",strokeWidth:300.126,strokeOpacity:1}}
       id="path1"/>
    <path
       inkscape:original-d="M 0,0"
       inkscape:path-effect="#path-effect21"
       d="m 2411,3694 c -453,-156 -830,-289 -838,-295 -20,-17 -16,-50 32,-283 l 45,-217 v -518 -518 l -64,-7 c -223,-23 -387,-171 -388,-351 0,-90 24,-155 84,-220 91,-100 202,-146 348,-146 180,0 326,81 402,223 l 23,43 3,776 2,776 73,27 c 149,53 860,296 869,296 4,0 8,-231 8,-514 v -513 l -68,-6 c -126,-10 -245,-72 -314,-163 -175,-230 4,-531 327,-551 198,-13 370,79 443,235 l 27,57 3,815 3,815 -51,239 c -27,132 -50,243 -50,247 0,18 -34,39 -63,38 -18,0 -403,-129 -856,-285 z"
       id="path21" />
    <path
       d="m 2411,3694 c -453,-156 -830,-289 -838,-295 -20,-17 -16,-50 32,-283 l 45,-217 v -518 -518 l -64,-7 c -223,-23 -387,-171 -388,-351 0,-90 24,-155 84,-220 91,-100 202,-146 348,-146 180,0 326,81 402,223 l 23,43 3,776 2,776 73,27 c 149,53 860,296 869,296 4,0 8,-231 8,-514 v -513 l -68,-6 c -126,-10 -245,-72 -314,-163 -175,-230 4,-531 327,-551 198,-13 370,79 443,235 l 27,57 3,815 3,815 -51,239 c -27,132 -50,243 -50,247 0,18 -34,39 -63,38 -18,0 -403,-129 -856,-285 z m 819,139 c 0,-5 18,-93 40,-197 l 40,-189 v -649 c 0,-356 -3,-648 -6,-648 -3,0 -19,9 -34,20 -16,12 -54,32 -85,45 l -55,25 v 577 c 0,522 -2,578 -17,595 -9,10 -24,18 -34,18 -10,0 -262,-84 -561,-186 -362,-124 -549,-193 -560,-206 -17,-19 -18,-64 -18,-649 0,-346 -2,-629 -5,-629 -2,0 -25,13 -51,30 -26,16 -62,34 -81,41 l -33,11 v 535 536 l -42,199 c -22,109 -39,201 -35,204 3,3 254,91 559,196 304,104 641,220 748,258 192,67 230,77 230,63 z m -85,-1737 c 104,-47 154,-115 155,-209 1,-203 -305,-310 -512,-178 -144,92 -143,274 2,366 68,43 119,55 210,52 67,-2 98,-9 145,-31 z M 1777,1705 c 173,-79 215,-245 91,-361 -125,-119 -360,-117 -483,3 -136,132 -57,330 152,383 65,16 176,5 240,-25 z"
       id="path2"/>
  </g>
    </svg>
}

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