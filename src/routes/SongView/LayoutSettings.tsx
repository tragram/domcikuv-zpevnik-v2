import { toggleSettingFactory } from "@/components/toogle-settings-factory";
import { Button } from "@/components/ui/button";
import { DropdownIconStart, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import FancySwitch from "@/components/ui/fancy-switch";
import { LoopNoteIcon } from "@/components/ui/loop-note-icon";
// import { LoopNoteIcon } from "@/components/ui/loop-note-icon";
import { AArrowDown, Ruler, AArrowUp, CaseSensitive, Plus, Minus, MoveDiagonal, MoveHorizontal, Guitar, Columns2, Repeat, UserCog, PencilRuler, MoveVertical, Expand, Maximize, Fullscreen } from "lucide-react";
import { useEffect } from "react";
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
    multiColumnNr: number;
    compactInFullScreen: boolean;
}

type LayoutPreset = "compact" | "maximizeFontSize" | "custom";
const presetModes: Array<LayoutPreset> = ["compact", "custom", "maximizeFontSize"];
const presetModesValues = {
    "maximizeFontSize": {
        label: "Scroll", icon: <MoveHorizontal />, preset: {
            fitScreenMode: "fitX",
            repeatParts: true,
            repeatPartsChords: true,
            multiColumnNr: 1,
        }
    },
    "custom": { label: "Custom", icon: <PencilRuler /> },
    "compact": {
        label: "Compact", icon: <MoveDiagonal />, preset: {
            fitScreenMode: "fitXY",
            repeatParts: false,
            repeatPartsChords: false
        }
    },
};

const layouSettingsBoolsKeys = ["repeatParts", "repeatPartsChords", "compactInFullScreen"]
const layoutSettingsValues = {
    "multiColumnNr": { icon: <Columns2 />, label: "View as multiple columns" },
    "repeatParts": { icon: <Repeat />, label: "Show repeated parts" },
    "repeatPartsChords": { icon: <LoopNoteIcon />, label: "Show chords in repeated parts" },
    "compactInFullScreen": { icon: <Maximize />, label: "Auto fullscreen in compact view" }
}

export function maxColFit() {
    let result;
    try {
        const sections = document.querySelectorAll(".song-content>.section");
        const columnWidth = parseInt(getComputedStyle(sections[0]).width, 10);
        const fullHeight = Array.from(sections).map(s => parseInt(getComputedStyle(s).height, 10)).reduce((partialSum, a) => partialSum + a, 0);
        console.log(fullHeight)
        const contentRatio = fullHeight / (1.6 * columnWidth);
        const screenRatio = screen.height / screen.width;
        console.log(contentRatio, screenRatio, contentRatio / screenRatio);
        result = contentRatio / screenRatio;
    }
    catch (e: Exception) {
        console.log(e)
        result = 2;
    }
    return Math.min(4, Math.max(2, Math.floor(result)));
}

function LayoutSettingsToolbar({ layoutSettings, setLayoutSettings, customLayoutPreset, setCustomLayoutPreset, fullScreenHandle }) {
    const toggleSettingLayout = toggleSettingFactory(layoutSettings, setLayoutSettings);
    const toggleSettingCustomLayout = toggleSettingFactory(customLayoutPreset, setCustomLayoutPreset);
    const toggleSetting = (params) => { toggleSettingLayout(params); toggleSettingCustomLayout(params); }
    const updateSetting = (key, value) => { setLayoutSettings({ ...layoutSettings, [key]: value }); setCustomLayoutPreset({ ...customLayoutPreset, [key]: value }); }
    const [layoutPreset, setLayoutPreset] = useLocalStorageState<LayoutPreset>("settings/SongView/LayoutPreset", { defaultValue: "compact" })



    const updateMultiColumnNr = () => updateSetting("multiColumnNr", layoutSettings.multiColumnNr === 1 ? 1 : maxColFit());
    useEffect(() => {
        window.addEventListener("resize", updateMultiColumnNr);

        return () => {
            window.removeEventListener("resize", updateMultiColumnNr);
        };
    }, []);
    // useEffect(() => {
    //     updateMultiColumnNr();
    // }, [layoutSettings.fontSize])


    useEffect(() => {
        const checkPreset = (preset: "maximizeFontSize" | "compact", currentSettings: LayoutSettings) => {
            for (const [key, value] of Object.entries(presetModesValues[preset].preset)) {
                if (currentSettings[key] != value) {
                    return false;
                }
            }
            return true;
        }
        if (checkPreset("maximizeFontSize", layoutSettings)) {
            setLayoutPreset("maximizeFontSize");
        }
        else if (checkPreset("compact", layoutSettings)) {
            setLayoutPreset("compact");
        } else { setLayoutPreset("custom") }
    }, [layoutSettings, setLayoutPreset])

    function applyLayoutPreset(layoutPreset: LayoutPreset) {
        setLayoutPreset(layoutPreset);
        if (layoutPreset === "compact") {
            const newLayoutSettings = {
                ...layoutSettings,
                ...presetModesValues["compact"].preset
            }
            setLayoutSettings(newLayoutSettings);
        }
        else if (layoutPreset === "maximizeFontSize") {
            const newLayoutSettings = {
                ...layoutSettings,
                ...presetModesValues["maximizeFontSize"].preset
            }
            setLayoutSettings(newLayoutSettings);
        } else if (layoutPreset === "custom") {
            setLayoutSettings(customLayoutPreset);
        }
    }
    function possiblyEnterFullScreen(value) {
        if (value == "compact" && layoutSettings.compactInFullScreen) { fullScreenHandle.enter() }
    }
    return (
        <>
            <Button id="two-cols-button" size="icon" variant="circular" className="max-sm:hidden" isActive={layoutSettings.multiColumnNr > 1} onClick={() => {
                updateSetting("multiColumnNr", layoutSettings.multiColumnNr > 1 ? 1 : maxColFit());
            }}>
                {layoutSettingsValues["multiColumnNr"].icon}
            </Button>
            <Button size="icon" variant="circular" className="max-[620px]:hidden" isActive={false} onClick={() => { fullScreenHandle.enter() }}>
                {<Fullscreen />}
            </Button>
            <div className='flex flex-grow h-full align-center justify-center hide-fancy-switch-label max-xsm:hidden'
                id="preset-selector-large">
                <FancySwitch options={presetModes.map(mode => { return { "icon": presetModesValues[mode].icon, label: presetModesValues[mode].label, "value": mode } })} setSelectedOption={(value: LayoutPreset) => { applyLayoutPreset(value); possiblyEnterFullScreen(value); }} selectedOption={layoutPreset} roundedClass={"rounded-full"} />
            </div>
            <div className='flex flex-grow h-full align-center justify-center hide-fancy-switch-label xsm:hidden'
                id="preset-selector-small">
                <FancySwitch options={presetModes.filter(m => m != "custom").map(mode => { return { "icon": presetModesValues[mode].icon, label: presetModesValues[mode].label, "value": mode } })} setSelectedOption={(value: LayoutPreset) => { applyLayoutPreset(value); possiblyEnterFullScreen(value); }} selectedOption={layoutPreset} roundedClass={"rounded-full"} hiddenHighlightOnOther={true} />
            </div>
        </>
    )
}

function LayoutSettingsDropdownSection({ layoutSettings, setLayoutSettings, customLayoutPreset, setCustomLayoutPreset, fullScreenHandle }) {
    // TODO: once JS stops being buggy (https://github.com/jsdom/jsdom/issues/2160), make it so that fontSize is read from the autoresizer, so there's not a jump when moving from auto to manual
    function setBothSettings(modifiedSettings) {
        setLayoutSettings({ ...layoutSettings, ...modifiedSettings });
        setCustomLayoutPreset({ ...customLayoutPreset, ...modifiedSettings });
    }
    const toggleSettingLayout = toggleSettingFactory(layoutSettings, setLayoutSettings);
    const toggleSettingCustomLayout = toggleSettingFactory(customLayoutPreset, setCustomLayoutPreset);
    const toggleSetting = (params) => { toggleSettingLayout(params); toggleSettingCustomLayout(params); }
    const updateSetting = (key, value) => { setLayoutSettings({ ...layoutSettings, [key]: value }); setCustomLayoutPreset({ ...customLayoutPreset, [key]: value }); }
    // useEffect(function toggleCustom() {
    //     setLayoutPreset("custom");
    // }, [setLayoutPreset, customLayoutPreset]);

    // TODO: explain better that this fit screen only changes font size while the fit screen in toolbar changes more stuff
    return (<>
        <DropdownMenuLabel>Font size</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
            key="fitXY"
            checked={layoutSettings.fitScreenMode == "fitXY"} onSelect={e => e.preventDefault()}
            onCheckedChange={() => setBothSettings({ "fitScreenMode": "fitXY" })}
        >
            <DropdownIconStart icon={<MoveDiagonal />} />
            Fit screen
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
            key="fitX"
            checked={layoutSettings.fitScreenMode == "fitX"} onSelect={e => e.preventDefault()}
            onCheckedChange={() => setBothSettings({ "fitScreenMode": "fitX" })}
        >
            <DropdownIconStart icon={<MoveHorizontal />} />
            Fit screen width
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onClick={() => { setBothSettings({ "fitScreenMode": "none", "fontSize": fontSizeLimits(layoutSettings.fontSize * fontSizeStep) }) }}
            onSelect={e => e.preventDefault()}>
            <DropdownIconStart icon={<AArrowUp />} />
            Increase font size
        </DropdownMenuItem >
        <DropdownMenuItem onClick={() => { setBothSettings({ "fitScreenMode": "none", "fontSize": fontSizeLimits(layoutSettings.fontSize / fontSizeStep) }) }}
            onSelect={e => e.preventDefault()} >
            <DropdownIconStart icon={<AArrowDown />} />
            Decrease font size
        </DropdownMenuItem >
        <DropdownMenuLabel>Contents</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => { fullScreenHandle.enter() }}>
            <DropdownIconStart icon={<Fullscreen />} />
            Enter fullscreen
        </DropdownMenuItem >
        <DropdownMenuCheckboxItem checked={layoutSettings.multiColumnNr > 1} onCheckedChange={() => {
            updateSetting("multiColumnNr", layoutSettings.multiColumnNr > 1 ? 1 : maxColFit());
        }}
            onSelect={e => e.preventDefault()}>
            <DropdownIconStart icon={<Columns2 />} />
            Multicolumn layout
        </DropdownMenuCheckboxItem >
        <DropdownMenuSeparator />
        {
            layouSettingsBoolsKeys.map(k => (
                <DropdownMenuCheckboxItem
                    key={k}
                    checked={layoutSettings[k]}
                    onCheckedChange={() => toggleSetting(k)}
                    onSelect={e => e.preventDefault()}
                >
                    <DropdownIconStart icon={layoutSettingsValues[k].icon} />
                    {layoutSettingsValues[k].label}
                </DropdownMenuCheckboxItem>
            ))
        }
    </>
    )
}


export { LayoutSettingsToolbar, LayoutSettingsDropdownSection, minFontSizePx, maxFontSizePx, LayoutSettings };