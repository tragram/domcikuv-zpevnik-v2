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
import { UserProfileData } from "src/worker/api/userProfile";
export interface EditorSettings {
  autoGenerateIllustration: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  autoGenerateIllustration: false,
};

interface EditorSettingsProps {
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  user: UserProfileData;
  hasIllustration?: boolean;
}

const EditorSettingsComponent: React.FC<EditorSettingsProps> = ({
  settings,
  onSettingsChange,
  user,
  hasIllustration = false,
}) => {
  const handleToggle = (key: keyof EditorSettings) => {
    onSettingsChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  // since there's only one setting, hide the whole component if not trusted (to be changed later on)
  return user.loggedIn && user.profile.isTrusted ? (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Editor Settings</h3>

      {user.loggedIn && user.profile.isTrusted && (
        <div className="flex items-center justify-between relative space-x-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="auto-illustration" className="text-xs">
              Auto-generate illustration on upload
            </Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3 text-muted-foreground cursor-help " />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Automatically generate an AI illustration when submitting a
                    new song. The illustration will be generated in the
                    background and set as active.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Switch
            id="auto-illustration"
            disabled={hasIllustration}
            checked={settings.autoGenerateIllustration}
            onCheckedChange={() => handleToggle("autoGenerateIllustration")}
          />
        </div>
      )}
    </div>
  ) : (
    <></>
  );
};

export default EditorSettingsComponent;
