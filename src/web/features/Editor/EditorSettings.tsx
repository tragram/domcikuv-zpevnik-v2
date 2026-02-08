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
import {
  AvailableImageModel,
  SummaryPromptVersion,
  AvailableSummaryModel,
  IMAGE_MODELS_API,
  SUMMARY_PROMPT_VERSIONS,
  SUMMARY_MODELS_API,
} from "src/worker/helpers/image-generator";

export interface EditorSettings {
  autoGenerateIllustration: boolean;
  // Default generation parameters
  defaultImageModel: AvailableImageModel;
  defaultPromptVersion: SummaryPromptVersion;
  defaultSummaryModel: AvailableSummaryModel;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  autoGenerateIllustration: false,
  defaultImageModel: IMAGE_MODELS_API[0], // "FLUX.1-dev"
  defaultPromptVersion: SUMMARY_PROMPT_VERSIONS[0], // "v2"
  defaultSummaryModel: SUMMARY_MODELS_API[0], // "gpt-4o-mini"
};

interface EditorSettingsProps {
  settings: EditorSettings;
  onSettingsChange: (settings: EditorSettings) => void;
  user: UserProfileData;
}

const EditorSettingsComponent: React.FC<EditorSettingsProps> = ({
  settings,
  onSettingsChange,
  user,
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
