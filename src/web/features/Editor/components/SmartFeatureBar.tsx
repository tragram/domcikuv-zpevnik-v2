import React from "react";
import { Button } from "~/components/ui/button";
import { Hourglass, X } from "lucide-react";
import { UserProfileData } from "src/worker/api/userProfile";
import { SongData } from "~/types/songData";

export interface SmartFeature {
  id: string;
  label: string;
  loadingLabel: string;
  icon: React.ElementType;
  description: React.ReactNode;
  check: (content: string, user: UserProfileData, songData?: SongData) => boolean;
}

interface SmartFeatureBarProps {
  feature: SmartFeature;
  isProcessing: boolean;
  onExecute: () => void;
  onDismiss: () => void;
}

export const SmartFeatureBar: React.FC<SmartFeatureBarProps> = ({
  feature,
  isProcessing,
  onExecute,
  onDismiss,
}) => {
  return (
    <div className="relative group animate-in slide-in-from-bottom-2 duration-300">
      {/* Description Tooltip/Drawer */}
      <div className="w-full overflow-hidden bg-muted border-t-2 border-primary px-4 text-xs hidden group-hover:visible group-hover:flex flex-col py-2 pr-8">
        <div className="font-bold mb-1 flex items-center gap-2">
          <feature.icon className="w-3 h-3" />
          {feature.label}
        </div>
        <div className="opacity-90">{feature.description}</div>

        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-black/10 rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Button
        onClick={onExecute}
        disabled={isProcessing}
        className="w-full rounded-none h-10 transition-transform font-semibold !bg-muted border-t-2 border-primary group-hover:border-t-0 flex items-center gap-2"
      >
        {isProcessing ? (
          <>
            <span className="animate-spin">
              <Hourglass className="size-4" />
            </span>
            {feature.loadingLabel}
          </>
        ) : (
          <>
            <feature.icon className="size-4" />
            {feature.label}
          </>
        )}
      </Button>
    </div>
  );
};
