import React from "react";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { UserData } from "src/web/hooks/use-user-data";

export interface EditorSettings {
  autoGenerateIllustration: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  autoGenerateIllustration: false,
};

interface EditorSettingsProps {
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  userData: UserData;
  hasIllustration?: boolean;
}

const EditorSettingsComponent: React.FC<EditorSettingsProps> = ({
  settings,
  onSettingsChange,
  userData,
  hasIllustration = false,
}) => {
  const handleToggle = (key: keyof EditorSettings) => {
    onSettingsChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  // since there's only one setting, hide the whole component if not trusted (to be changed later on)
  return userData && userData.profile.isTrusted ? (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Editor Settings</h3>

      {userData && userData.profile.isTrusted && (
        <div className="flex items-center justify-between relative space-x-2 w-full">
          <Switch
            id="auto-illustration"
            disabled={hasIllustration}
            checked={settings.autoGenerateIllustration}
            onCheckedChange={() => handleToggle("autoGenerateIllustration")}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-illustration" className="text-xs">
              Auto-generate illustration on upload
            </Label>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-4 text-muted-foreground cursor-help shrink-0 hover:text-primary transition-colors" />
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="max-w-xs p-3 border-primary/20"
                >
                  <div className="text-sm">
                    Automatically generate an AI illustration when submitting a
                    new song. The illustration will be generated in the
                    background and set as active.
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
    </div>
  ) : (
    <></>
  );
};

export default EditorSettingsComponent;
