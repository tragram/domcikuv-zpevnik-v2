import React, { useId } from "react";
import { Switch } from "~/components/ui/switch";
import { buttonVariants } from "~/components/ui/button";
import { Image } from "lucide-react";
import { cn } from "~/lib/utils";
import { EditorInfo } from "./components/EditorInfo";
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
  const switchId = useId();
  // Admins may generate illustrations even without the trusted flag
  // (the server's adminOrTrustedMiddleware allows either).
  const isTrusted = !!userData?.profile.isTrusted || !!userData?.profile.isAdmin;

  if (!isTrusted) return null;

  return (
    <div className="flex items-center gap-1">
      <label htmlFor={switchId} className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "h-auto min-w-0 flex-1 justify-start whitespace-normal py-2 text-left",
        hasIllustration ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}>
        <Image aria-hidden className="size-4" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">Auto-generate illustration</span>
        <Switch
          id={switchId}
          disabled={hasIllustration}
          checked={settings.autoGenerateIllustration}
          onCheckedChange={(autoGenerateIllustration) => onSettingsChange({ autoGenerateIllustration })}
        />
      </label>
      <EditorInfo label="Auto-generate illustration">{hasIllustration ? "This song already has an illustration." : "Generate on upload and set as the active illustration."}</EditorInfo>
    </div>
  );
};

export default EditorSettingsComponent;
