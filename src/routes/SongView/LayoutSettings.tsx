import { Button } from "@/components/ui/button";
import { DropdownIconStart, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import FancySwitch from "@/components/ui/fancy-switch";
// import { LoopNoteIcon } from "@/components/ui/loop-note-icon";
import { AArrowDown, Ruler, AArrowUp, CaseSensitive, Plus, Minus, MoveDiagonal, MoveHorizontal, Guitar, Columns2, Repeat } from "lucide-react";

const minFontSizePx = 4;
const maxFontSizePx = 160;
const fontSizeLimits = (fontSize: number) => Math.min(Math.max(minFontSizePx, fontSize), maxFontSizePx);
const fontSizeStep = 1.1;

type FitScreenMode = "none" | "fitX" | "fitXY";
interface LayoutSettings {
    fitScreenMode: FitScreenMode;
    fontSize: number;
    showChords: boolean;
    repeatParts: boolean;
    repeatPartsChords: boolean;
    twoColumns: boolean;
}

type LayoutPreset = "compact" | "maximizeFontSize" | "custom";
const presetModes: Array<LayoutPreset> = ["compact", "maximizeFontSize"];
const presetModesIcons = {
    "maximizeFontSize": <MoveHorizontal />,
    "compact": <MoveDiagonal />
};

const layouSettingsBoolsKeys = ["showChords", "twoColumns", "repeatParts", "repeatPartsChords"]
const layoutSettingsBools = {
    "showChords": { icon: <Guitar />, label: "Show chords" },
    "twoColumns": { icon: <Columns2 />, label: "View as two columns" },
    "repeatParts": { icon: <Repeat />, label: "Show repeated parts" },
    "repeatPartsChords": { icon: <Repeat />, label: "Show chords in repeated parts" },
}

const toggleSettingFactory = (layoutSettings, setLayoutSettings) => {
    return function toggleSetting(setting: string) {
        if (typeof layoutSettings[setting] == "boolean") {
            setLayoutSettings({ ...layoutSettings, [setting]: !layoutSettings[setting] })
        } else {
            console.log("Error: Could not toggle ", setting)
        }
    }
}

function LayoutSettingsToolbar({ layoutSettings, setLayoutSettings }) {
    const toggleSetting = toggleSettingFactory(layoutSettings, setLayoutSettings);
    function applyLayoutPreset(layoutPreset: LayoutPreset) {
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
                repeatPartsChords: true
            }
            setLayoutSettings(newLayoutSettings);
        }
        // custom doesn't change anything
    }
    return (
        <>
            <Button size="icon" className="rounded-full" onClick={() => { toggleSetting("showChords") }}>
                {layoutSettingsBools["showChords"].icon}
            </Button >
            <Button size="icon" className="rounded-full" onClick={() => { toggleSetting("twoColumns") }}>
                {layoutSettingsBools["twoColumns"].icon}
            </Button>
            <FancySwitch options={presetModes.map(mode => { return { "icon": presetModesIcons[mode], label: mode, "value": mode } })} setSelectedOption={(value: LayoutPreset) => applyLayoutPreset(value)} selectedOption={layoutSettings.fitScreenMode} />
        </>
    )
}

function LayoutSettingsDropdownSection({ layoutSettings, setLayoutSettings }) {
    // TODO: once JS stops being buggy (https://github.com/jsdom/jsdom/issues/2160), make it so that fontSize is read from the autoresizer, so there's not a jump when moving from auto to manual
    const toggleSetting = toggleSettingFactory(layoutSettings, setLayoutSettings);
    return (<>
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Font size</DropdownMenuLabel>
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
            <DropdownIconStart icon={<MoveDiagonal />} />
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
        {layouSettingsBoolsKeys.map(k => (
            <DropdownMenuCheckboxItem
                key={k}
                checked={layoutSettings[k]}
                onCheckedChange={() => toggleSetting(k)}
                onSelect={e => e.preventDefault()}
            >
                <DropdownIconStart icon={layoutSettingsBools[k].icon} />
                {layoutSettingsBools[k].label}
            </DropdownMenuCheckboxItem>
        ))}
    </>


    )
}


export { LayoutSettingsToolbar, LayoutSettingsDropdownSection, minFontSizePx, maxFontSizePx, LayoutSettings };