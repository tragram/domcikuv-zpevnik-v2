import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { AArrowDown, Ruler, AArrowUp, CaseSensitive, Plus, Minus, MoveDiagonal, MoveHorizontal } from "lucide-react";


// TODO: these are defined in both songview and fontsizesettings
const minFontSizePx = 4;
const maxFontSizePx = 160;
const fontSizeLimits = (fontSize) => Math.min(Math.max(minFontSizePx, fontSize), maxFontSizePx);

function FontSizeSettings({ fontSize, setFontSize, fitScreenMode, setfitScreenMode }) {
    const fontSizeStep = 1.1;
    // TODO: once JS stops being buggy (https://github.com/jsdom/jsdom/issues/2160), make it so that fontSize is read from the autoresizer, so there's not a jump when moving from auto to manual
    return (
        <>
            <div className='hidden sm:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setfitScreenMode("none"); setFontSize(fontSizeLimits(fontSize / fontSizeStep)) }} variant="ghost"><AArrowDown /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setfitScreenMode("XY") }} variant={fitScreenMode === "XY" ? "solid" : "ghost"}><MoveDiagonal /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setfitScreenMode("X") }} variant={fitScreenMode === "X" ? "solid" : "ghost"}><MoveHorizontal /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setfitScreenMode("none"); setFontSize(fontSizeLimits(fontSize * fontSizeStep)) }} variant="ghost"><AArrowUp /></Button>
                </ButtonGroup>
            </div>
            <div className='flex sm:hidden'>
                <Dropdown closeOnSelect={false} disableAnimation>
                    <DropdownTrigger>
                        <Button
                            variant="ghost" color="primary" isIconOnly
                        >
                            <CaseSensitive />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Change font size">
                        <DropdownItem startContent={<MoveDiagonal />} key="fitXY" onClick={() => { setfitScreenMode("XY") }}>
                            Fit screen
                        </DropdownItem>
                        <DropdownItem startContent={<MoveHorizontal />} key="fitX" onClick={() => { setfitScreenMode("X") }}>
                            Fit screen width
                        </DropdownItem>
                        <DropdownItem startContent={<Plus />} key="+" onClick={() => { setfitScreenMode("none"); setFontSize(fontSizeLimits(fontSize * fontSizeStep)) }}>
                            Increase font size
                        </DropdownItem>
                        <DropdownItem startContent={<Minus />} key="-" onClick={() => { setfitScreenMode("none"); setFontSize(fontSizeLimits(fontSize / fontSizeStep)) }}>
                            Decrease font size
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

export { FontSizeSettings, minFontSizePx, maxFontSizePx };