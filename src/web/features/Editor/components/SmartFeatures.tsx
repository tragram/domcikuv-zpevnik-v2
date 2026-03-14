import React from "react";
import { Info } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { EvaluatedFeature, SmartFeature } from "../Editor";

// --- Sub-component for individual features ---
interface SmartFeatureItemProps {
  feature: EvaluatedFeature;
  isProcessing: boolean;
  onExecuteFeature: (feature: SmartFeature) => void;
}

const SmartFeatureItem: React.FC<SmartFeatureItemProps> = ({
  feature,
  isProcessing,
  onExecuteFeature,
}) => {
  return (
    <div className="flex items-center gap-2 w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} className="flex-1 min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!feature.isEnabled || isProcessing}
              onMouseDown={(e) => e.preventDefault()} // MAGIC FIX: Prevents focus stealing!
              onClick={() => onExecuteFeature(feature)}
              className="w-full h-auto py-2 justify-start text-left whitespace-normal text-xs shadow-sm bg-secondary/30 hover:bg-secondary/60 border-primary/10 transition-colors"
            >
              <feature.icon className="w-4 h-4 mr-2 shrink-0 mt-0.5 self-center" />
              <span className="leading-snug">
                {isProcessing && feature.isEnabled
                  ? feature.loadingLabel
                  : feature.label}
              </span>
            </Button>
          </div>
        </TooltipTrigger>
        {!feature.isEnabled && (
          <TooltipContent side="right" className="max-w-xs p-3">
            <div className="text-sm font-semibold text-muted">
              Disabled
            </div>
            <div className="text-xs text-muted">
              {feature.disabledReason}
            </div>
          </TooltipContent>
        )}
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-4 cursor-help shrink-0 hover:text-primary transition-colors" />
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs p-3 border-primary/20">
          <div className="text-sm">{feature.description}</div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};

// --- Main export for the feature list ---
interface SmartFeaturesProps {
  features: EvaluatedFeature[];
  isProcessing: boolean;
  onExecuteFeature: (feature: SmartFeature) => void;
}

const SmartFeatures: React.FC<SmartFeaturesProps> = ({
  features,
  isProcessing,
  onExecuteFeature,
}) => {
  if (features.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <h3 className="text-sm font-medium">Smart Features</h3>
      <div className="flex flex-col gap-2">
        <TooltipProvider delayDuration={200}>
          {features.map((feature) => (
            <SmartFeatureItem
              key={feature.id}
              feature={feature}
              isProcessing={isProcessing}
              onExecuteFeature={onExecuteFeature}
            />
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
};

export default SmartFeatures;
