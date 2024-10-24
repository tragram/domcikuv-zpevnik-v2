import { ButtonGroup, Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { AArrowDown, Ruler, AArrowUp, CaseSensitive, Plus, Minus } from "lucide-react";


// TODO: these are defined in both songview and fontsizesettings
const minFontSizePx = 8;
const maxFontSizePx = 160;
const fontSizeLimits = (fontSize) => Math.min(Math.max(minFontSizePx, fontSize), maxFontSizePx);

function FontSizeSettings({ fontSize, setFontSize, autoFontSize, setAutoFontSize }) {
    const fontSizeStep = 1.1;
    // TODO: once JS stops being buggy (https://github.com/jsdom/jsdom/issues/2160), make it so that fontSize is read from the autoresizer, so there's not a jump when moving from auto to manual
    return (
        <>
            <div className='hidden sm:flex'>
                <ButtonGroup>
                    <Button color="primary" isIconOnly onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize / fontSizeStep)) }} variant="ghost"><AArrowDown /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setAutoFontSize(!autoFontSize) }} variant={autoFontSize ? "solid" : "ghost"}><Ruler /></Button>
                    <Button color="primary" isIconOnly onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize * fontSizeStep)) }} variant="ghost"><AArrowUp /></Button>
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
                        <DropdownItem startContent={<Ruler />} key="auto" onClick={() => { setAutoFontSize(!autoFontSize) }}>
                            Auto font size
                        </DropdownItem>
                        <DropdownItem startContent={<Plus />} key="+" onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize * fontSizeStep)) }}>
                            Increase font size
                        </DropdownItem>
                        <DropdownItem startContent={<Minus />} key="-" onClick={() => { setAutoFontSize(false); setFontSize(fontSizeLimits(fontSize / fontSizeStep)) }}>
                            Decrease font size
                        </DropdownItem>
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    )
}

export { FontSizeSettings, minFontSizePx, maxFontSizePx };