import { Guitar, Piano, ChevronsLeftRightEllipsis } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { DropdownIconStart, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '~/components/ui/dropdown-menu';
import { useViewSettingsStore } from '../hooks/viewSettingsStore';

export interface ChordSettings {
  showChords: boolean;
  czechChordNames: boolean;
  inlineChords: boolean;
}

const chordSettingsNames = ["showChords", "czechChordNames", "inlineChords"];

const chordSettingsValues = {
  showChords: { icon: <Guitar />, label: "Show chords", description: "" },
  czechChordNames: { icon: <Piano />, label: '"Czech" notes', description: "uses notes A-B-H-C" },
  inlineChords: { icon: <ChevronsLeftRightEllipsis />, label: "Chords inline", description: "" }
};

export const chordSettingsClassNames = (chords: ChordSettings) => {
  return [chords.inlineChords ? 'chords-inline' : '',
  chords.showChords ? '' : 'chords-hidden']
}

export const ChordSettingsDropdownMenu: React.FC = () => {
  const { chords: chordSettings, actions } = useViewSettingsStore();

  const toggleSetting = (key: keyof ChordSettings) => {
    actions.setChordSettings({ [key]: !chordSettings[key] });
  };

  return (
    <>
      <DropdownMenuLabel>Chord settings</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {chordSettingsNames.map(k => (
        <DropdownMenuCheckboxItem
          key={k}
          checked={chordSettings[k as keyof ChordSettings]}
          disabled={k !== "showChords" && !chordSettings.showChords}
          onCheckedChange={() => toggleSetting(k as keyof ChordSettings)}
          onSelect={e => e.preventDefault()}
        >
          <DropdownIconStart icon={chordSettingsValues[k as keyof typeof chordSettingsValues].icon} />
          <div>{chordSettingsValues[k as keyof typeof chordSettingsValues].label}<p className='text-[0.7em] leading-tight'>{chordSettingsValues[k as keyof typeof chordSettingsValues].description}</p></div>
        </DropdownMenuCheckboxItem>
      ))}
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