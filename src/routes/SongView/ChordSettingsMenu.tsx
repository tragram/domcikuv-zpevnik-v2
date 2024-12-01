import { toggleSettingFactory } from "@/components/toogle-settings-factory";
import { Button } from "@/components/ui/button";
import { DropdownIconStart, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Guitar, Piano, ChevronsLeftRightEllipsis } from "lucide-react";

export interface ChordSettings {
    showChords: boolean,
    czechChordNames: boolean,
    inlineChords: boolean
}

const chordSettingsNames = ["showChords", "czechChordNames", "inlineChords"];

const chordSettingsValues = {
    "showChords": { icon: <Guitar />, label: "Show chords" },
    "czechChordNames": { icon: <Piano />, label: "Czech notes (A-B-H-C)" },
    "inlineChords": { icon: <ChevronsLeftRightEllipsis />, label: "Chords inline" }
}

function ChordSettingsMenu({ chordSettings, setChordSettings }) {
    const toggleSetting = toggleSettingFactory(chordSettings, setChordSettings);
    return (<>
        <DropdownMenuLabel>Chord settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {
            chordSettingsNames.map(k => (
                <DropdownMenuCheckboxItem
                    key={k}
                    checked={chordSettings[k]}
                    disabled={k != "showChords" && !chordSettings.showChords}
                    onCheckedChange={() => toggleSetting(k)}
                    onSelect={e => e.preventDefault()}
                >
                    <DropdownIconStart icon={chordSettingsValues[k].icon} />
                    {chordSettingsValues[k].label}
                </DropdownMenuCheckboxItem>
            ))
        }
    </>)
}

function ChordSettingsButtons({ chordSettings, setChordSettings }) {
    const toggleSetting = toggleSettingFactory(chordSettings, setChordSettings);
    return <>
        <Button size="icon" variant="circular" isActive={chordSettings.showChords} className="hidden sm:flex" onClick={() => { toggleSetting("showChords") }}>
            {chordSettingsValues["showChords"].icon}
        </Button >

        <Button size="icon" variant="circular" className="max-[620px]:hidden" isActive={chordSettings.inlineChords} onClick={() => { toggleSetting("inlineChords") }}>
            {chordSettingsValues.inlineChords.icon}
        </Button>
    </>
}

export { ChordSettingsMenu, ChordSettingsButtons };