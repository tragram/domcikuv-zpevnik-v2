import { toggleSettingFactory } from "@/components/toogle-settings-factory";
import { Button } from "@/components/ui/button";
import { DropdownIconStart, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import FancySwitch from "@/components/ui/fancy-switch";
// import { LoopNoteIcon } from "@/components/ui/loop-note-icon";
import { AArrowDown, Ruler, AArrowUp, CaseSensitive, Plus, Minus, MoveDiagonal, MoveHorizontal, Guitar, Columns2, Repeat, UserCog, PencilRuler } from "lucide-react";
import useLocalStorageState from "use-local-storage-state";

const minFontSizePx = 4;
const maxFontSizePx = 160;
const fontSizeLimits = (fontSize: number) => Math.min(Math.max(minFontSizePx, fontSize), maxFontSizePx);
const fontSizeStep = 1.1;

type FitScreenMode = "none" | "fitX" | "fitXY";
interface LayoutSettings {
    fitScreenMode: FitScreenMode;
    fontSize: number;
    repeatParts: boolean;
    repeatPartsChords: boolean;
    twoColumns: boolean;
}

type LayoutPreset = "compact" | "maximizeFontSize" | "custom";
const presetModes: Array<LayoutPreset> = ["compact", "custom", "maximizeFontSize"];
const presetModesValues = {
    "maximizeFontSize": { "label": "Max font size", "icon": <MoveHorizontal /> },
    "custom": { "label": "Custom", "icon": <PencilRuler /> },
    "compact": { "label": "Fit screen", "icon": <MoveDiagonal /> },
};

const layouSettingsBoolsKeys = ["twoColumns", "repeatParts", "repeatPartsChords"]
const layoutSettingsValues = {
    "twoColumns": { icon: <Columns2 />, label: "View as two columns" },
    "repeatParts": { icon: <Repeat />, label: "Show repeated parts" },
    "repeatPartsChords": { icon: <Repeat />, label: "Show chords in repeated parts" },
}



function LayoutSettingsToolbar({ layoutSettings, setLayoutSettings }) {
    const toggleSetting = toggleSettingFactory(layoutSettings, setLayoutSettings);
    const [layoutPreset, setLayoutPreset] = useLocalStorageState<LayoutPreset>("settings/SongView/LayoutPreset", { defaultValue: "compact" })
    function applyLayoutPreset(layoutPreset: LayoutPreset) {
        setLayoutPreset(layoutPreset);
        if (layoutPreset === "compact") {
            const newLayoutSettings = {
                ...layoutSettings,
                fitScreenMode: "fitXY",
                repeatParts: false,
                repeatPartsChords: false
            }
            setLayoutSettings(newLayoutSettings);
        }
        else if (layoutPreset === "maximizeFontSize") {
            const newLayoutSettings = {
                ...layoutSettings,
                fitScreenMode: "fitX",
                repeatParts: true,
                repeatPartsChords: true,
                twoColumns: false,
            }
            setLayoutSettings(newLayoutSettings);
        }
        // custom doesn't change anything
    }
    return (
        <>
            <Button size="icon" variant="circular" className="max-sm:hidden" isActive={layoutSettings.twoColumns} onClick={() => { toggleSetting("twoColumns") }}>
                {layoutSettingsValues["twoColumns"].icon}
            </Button>
            <div className='flex flex-grow h-full align-center justify-center hide-fancy-switch-label max-xs:hidden'>
                <FancySwitch options={presetModes.map(mode => { return { "icon": presetModesValues[mode].icon, label: presetModesValues[mode].label, "value": mode } })} setSelectedOption={(value: LayoutPreset) => applyLayoutPreset(value)} selectedOption={layoutPreset} roundedClass={"rounded-full"}/>
            </div>
            <div className='flex flex-grow h-full align-center justify-center hide-fancy-switch-label xs:hidden'>
                <FancySwitch options={presetModes.filter(m=>m!="custom").map(mode => { return { "icon": presetModesValues[mode].icon, label: presetModesValues[mode].label, "value": mode } })} setSelectedOption={(value: LayoutPreset) => applyLayoutPreset(value)} selectedOption={layoutPreset} roundedClass={"rounded-full"}/>
            </div>
        </>
    )
}

function LayoutSettingsDropdownSection({ layoutSettings, setLayoutSettings }) {
    // TODO: once JS stops being buggy (https://github.com/jsdom/jsdom/issues/2160), make it so that fontSize is read from the autoresizer, so there's not a jump when moving from auto to manual
    const toggleSetting = toggleSettingFactory(layoutSettings, setLayoutSettings);
    return (<>
        <DropdownMenuLabel>Font size</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
            key="fitXY"
            checked={layoutSettings.fitScreenMode == "fitXY"}
            onCheckedChange={() => setLayoutSettings({ ...layoutSettings, fitScreenMode: "fitXY" })}
        >
            <DropdownIconStart icon={<MoveDiagonal />} />
            Fit screen
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
            key="fitX"
            checked={layoutSettings.fitScreenMode == "fitX"}
            onCheckedChange={() => setLayoutSettings({ ...layoutSettings, fitScreenMode: "fitX" })}
        >
            <DropdownIconStart icon={<MoveHorizontal />} />
            Fit screen width
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onClick={() => { setLayoutSettings({ ...layoutSettings, fitScreenMode: "none", fontSize: fontSizeLimits(layoutSettings.fontSize * fontSizeStep) }) }}
            onSelect={e => e.preventDefault()}>
            <DropdownIconStart icon={<AArrowUp />} />
            Increase font size
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setLayoutSettings({ ...layoutSettings, fitScreenMode: "none", fontSize: fontSizeLimits(layoutSettings.fontSize / fontSizeStep) }) }}
            onSelect={e => e.preventDefault()}>
            <DropdownIconStart icon={<AArrowDown />} />
            Decrease font size
        </DropdownMenuItem>
        <DropdownMenuLabel>Contents</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {layouSettingsBoolsKeys.map(k => (
            <DropdownMenuCheckboxItem
                key={k}
                checked={layoutSettings[k]}
                onCheckedChange={() => toggleSetting(k)}
                onSelect={e => e.preventDefault()}
            >
                <DropdownIconStart icon={layoutSettingsValues[k].icon} />
                {layoutSettingsValues[k].label}
            </DropdownMenuCheckboxItem>
        ))}
    </>


    )
}


export { LayoutSettingsToolbar, LayoutSettingsDropdownSection, minFontSizePx, maxFontSizePx, LayoutSettings };