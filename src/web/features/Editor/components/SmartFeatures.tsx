import React from "react";
import { Info, Minus, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { EvaluatedFeature, SmartFeature } from "../Editor";
import { cn } from "~/lib/utils";

// --- Sub-component for individual features ---
interface SmartFeatureItemProps {
  feature: EvaluatedFeature;
  isProcessing: boolean;
  onExecuteFeature: (feature: SmartFeature, payload?: any) => void;
}

const SmartFeatureItem: React.FC<SmartFeatureItemProps> = ({
  feature,
  isProcessing,
  onExecuteFeature,
}) => {
  const isStepper = feature.actionType === "stepper";

  const triggerContent = isStepper ? (
    <div tabIndex={0} className="flex-1 min-w-0 text-primary">
      <div 
        className={cn(
          // Forced bg-transparent to remove the lighter background fill
          "flex w-full items-stretch justify-between text-left text-xs font-medium border border-border dark:border-input shadow-xs rounded-md transition-all bg-transparent",
          (!feature.isEnabled || isProcessing) &&
            "opacity-50 pointer-events-none",
        )}
      >
        <div className="flex flex-1 items-center gap-1.5 py-2 px-2.5 min-w-0">
          <feature.icon className="size-4 shrink-0 self-center" />
          <span className="leading-snug whitespace-normal">
            {isProcessing && feature.isEnabled
              ? feature.loadingLabel
              : feature.label}
          </span>
        </div>

        <div className="flex items-stretch border-l border-border dark:border-input shrink-0">
          <button
            type="button"
            disabled={!feature.isEnabled || isProcessing}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecuteFeature(feature, -1)}
            className="px-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <Minus className="size-3" />
          </button>
          <div className="w-px bg-border dark:bg-input" />
          <button
            type="button"
            disabled={!feature.isEnabled || isProcessing}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onExecuteFeature(feature, 1)}
            className="px-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-colors rounded-r-md flex items-center justify-center disabled:opacity-50"
          >
            <Plus className="size-3" />
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div tabIndex={0} className="flex-1 min-w-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!feature.isEnabled || isProcessing}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onExecuteFeature(feature)}
        // Added bg-transparent here too just in case your Button variant forces a background
        className="w-full h-auto py-2 px-2.5 justify-start text-left whitespace-normal text-xs bg-transparent"
      >
        <feature.icon className="size-4 shrink-0 self-center" />
        <span className="leading-snug">
          {isProcessing && feature.isEnabled
            ? feature.loadingLabel
            : feature.label}
        </span>
      </Button>
    </div>
  );

  return (
    <div className="flex items-center gap-2 w-full">
      <Tooltip>
        <TooltipTrigger asChild>{triggerContent}</TooltipTrigger>
        {!feature.isEnabled && (
          <TooltipContent side="right" className="max-w-xs p-3">
            <div className="text-sm font-semibold text-muted">Disabled</div>
            <div className="text-xs text-muted">{feature.disabledReason}</div>
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
  onExecuteFeature: (feature: SmartFeature, payload?: any) => void;
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
