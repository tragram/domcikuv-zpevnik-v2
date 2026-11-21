import { Settings2 } from "lucide-react";
import React from "react";
import { CompactItem } from "~/components/RichDropdown";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useViewSettingsStore } from "../../SongView/hooks/viewSettingsStore";
import { ChordSettingsDropdownMenu } from "../../SongView/settings/ChordSettingsMenu";
import { layoutSettingsValues } from "../../SongView/settings/LayoutSettings";

const SettingsDropdown: React.FC = () => {
  const { layout, actions } = useViewSettingsStore();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="toolbar">
          Settings
          <Settings2 size={32} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 max-h-[85dvh] overflow-y-auto">
        <CompactItem.Header>Contents</CompactItem.Header>
        <DropdownMenuSeparator />
        {(["repeatParts", "repeatPartsChords"] as const).map((key) => {
          const setting = layoutSettingsValues[key];
          return (
            <DropdownMenuCheckboxItem
              key={key}
              checked={layout[key]}
              onCheckedChange={(checked) =>
                actions.setLayoutSettings({ [key]: checked })
              }
              onSelect={(event) => event.preventDefault()}
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
        {React.Children.toArray(<ChordSettingsDropdownMenu />)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SettingsDropdown;
