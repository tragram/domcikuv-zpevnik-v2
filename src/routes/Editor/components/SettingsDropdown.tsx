import { Button } from '@/components/ui/button';
import { DropdownIconStart, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useViewSettingsStore } from "@/routes/SongView/hooks/viewSettingsStore";
import { Settings2 } from 'lucide-react';
import React from 'react';
import { LayoutSettings } from '../../SongView/hooks/viewSettingsStore';
import { ChordSettingsDropdownMenu } from '../../SongView/settings/ChordSettingsMenu';
import { layoutSettingsValues } from '../../SongView/settings/LayoutSettings';

const SettingsDropdown: React.FC = ({ }) => {
    const { layout, chords, actions } = useViewSettingsStore();
    return (
        <DropdownMenu modal={false} >
            <DropdownMenuTrigger asChild>
                <Button>
                    Settings
                    <Settings2 size={32} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-[85dvh] overflow-y-auto">
                <DropdownMenuLabel>Contents</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["repeatParts", "repeatPartsChords"] as (keyof LayoutSettings)[]).map(k => (
                    <DropdownMenuCheckboxItem
                        key={k}
                        checked={layout[k] as boolean}
                        onCheckedChange={() => actions.setLayoutSettings({ [k]: !layout[k] })}
                        onSelect={e => e.preventDefault()}
                    >
                        <DropdownIconStart icon={layoutSettingsValues[k].icon} />
                        {layoutSettingsValues[k].label}
                    </DropdownMenuCheckboxItem>
                ))}
                {React.Children.toArray(<ChordSettingsDropdownMenu />)}
            </DropdownMenuContent>
        </DropdownMenu >
    );
};

export default SettingsDropdown;