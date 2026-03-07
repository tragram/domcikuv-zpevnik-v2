import React from "react";
import { Guitar, Piano, ChevronsLeftRightEllipsis } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import { useViewSettingsStore } from "../hooks/viewSettingsStore";
import { CompactItem } from "~/components/RichDropdown";

export interface ChordSettings {
  showChords: boolean;
  czechChordNames: boolean;
  inlineChords: boolean;
}

const chordSettingsNames = ["showChords", "czechChordNames", "inlineChords"];

const chordSettingsValues = {
  showChords: { icon: <Guitar />, label: "Show chords", description: "" },
  czechChordNames: {
    icon: <Piano />,
    label: "Czech notation",
    description: "Uses A-B-H-C instead of A-Bb-B-C",
  },
  inlineChords: {
    icon: <ChevronsLeftRightEllipsis />,
    label: "Chords inline",
    description: "",
  },
};

export const chordSettingsClassNames = (chords: ChordSettings) => {
  return [
    chords.inlineChords ? "chords-inline" : "",
    chords.showChords ? "" : "chords-hidden",
  ];
};

export const ChordSettingsDropdownMenu: React.FC = () => {
  const { chords: chordSettings, actions } = useViewSettingsStore();

  const toggleSetting = (key: keyof ChordSettings) => {
    actions.setChordSettings({ [key]: !chordSettings[key] });
  };

  return (
    <>
      <CompactItem.Header>Chord settings</CompactItem.Header>
      <DropdownMenuSeparator />
      {chordSettingsNames.map((k) => {
        const setting =
          chordSettingsValues[k as keyof typeof chordSettingsValues];
        return (
          <DropdownMenuCheckboxItem
            key={k}
            checked={chordSettings[k as keyof ChordSettings]}
            disabled={k !== "showChords" && !chordSettings.showChords}
            onCheckedChange={() => toggleSetting(k as keyof ChordSettings)}
            onSelect={(e) => e.preventDefault()}
          >
            <CompactItem.Shell>
              <CompactItem.Icon>{setting.icon}</CompactItem.Icon>
              <CompactItem.Body
                title={setting.label}
                subtitle={setting.description || undefined}
              />
            </CompactItem.Shell>
          </DropdownMenuCheckboxItem>
        );
      })}
    </>
  );
};

export const ChordSettingsButtons: React.FC = () => {
  const { chords: chordSettings, actions } = useViewSettingsStore();

  const toggleSetting = (key: keyof ChordSettings) => {
    actions.setChordSettings({ [key]: !chordSettings[key] });
  };

  return (
    <>
      <Button
        size="icon"
        variant="circular"
        isActive={chordSettings.showChords}
        className="hidden sm:flex"
      onClick={() => toggleSetting("showChords")}
      >
        {chordSettingsValues.showChords.icon}
      </Button>
      <Button
        size="icon"
        variant="circular"
        className="max-[620px]:hidden"
        isActive={chordSettings.inlineChords}
        disabled={!chordSettings.showChords}
        onClick={() => toggleSetting("inlineChords")}
      >
        {chordSettingsValues.inlineChords.icon}
      </Button>
    </>
  );
};
