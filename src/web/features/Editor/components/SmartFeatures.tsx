import { EditorInfo } from "./EditorInfo";
import { Minus, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { EvaluatedFeature, SmartFeature } from "../Editor";

interface SmartFeatureItemProps {
  feature: EvaluatedFeature;
  isProcessing: boolean;
  onExecuteFeature: (feature: SmartFeature, payload?: number) => void;
}

export function SmartFeatureItem({ feature, isProcessing, onExecuteFeature }: SmartFeatureItemProps) {
  const disabled = !feature.isEnabled || isProcessing;
  const label = isProcessing && feature.isEnabled ? feature.loadingLabel : feature.label;
  const help = (
    <EditorInfo label={feature.label}>
      <div>{feature.description}</div>
      {!feature.isEnabled && <p className="font-medium text-foreground">{feature.disabledReason}</p>}
    </EditorInfo>
  );

  if (feature.actionType === "stepper") {
    return (
      <div role="group" aria-label={label} className="min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-wide">{label}</span>
          {help}
        </div>
        <div className="grid h-10 grid-cols-2 overflow-hidden rounded-md border border-border bg-control-surface [&>button]:h-full">
          <Button type="button" variant="ghost" size="sm" className="rounded-none border-r border-border shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2" disabled={disabled} aria-label="Transpose down one semitone"
            onMouseDown={event => event.preventDefault()} onClick={() => onExecuteFeature(feature, -1)}>
            <Minus aria-hidden className="size-4" /> Down
          </Button>
          <Button type="button" variant="ghost" size="sm" className="rounded-none shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2" disabled={disabled} aria-label="Transpose up one semitone"
            onMouseDown={event => event.preventDefault()} onClick={() => onExecuteFeature(feature, 1)}>
            <Plus aria-hidden className="size-4" /> Up
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="sm" disabled={disabled}
        onMouseDown={event => event.preventDefault()} onClick={() => onExecuteFeature(feature)}
        className="h-auto min-w-0 flex-1 justify-start whitespace-normal py-2 text-left">
        <feature.icon aria-hidden className="size-4" /> {label}
      </Button>
      {help}
    </div>
  );
}

interface SmartFeaturesProps {
  features: EvaluatedFeature[];
  isProcessing: boolean;
  onExecuteFeature: (feature: SmartFeature, payload?: number) => void;
}

const SmartFeatures: React.FC<SmartFeaturesProps> = ({
  features,
  isProcessing,
  onExecuteFeature,
}) => {
  if (features.length === 0) return null;

  return (
    <>
      {features.map((feature) => (
        <SmartFeatureItem key={feature.id} feature={feature} isProcessing={isProcessing} onExecuteFeature={onExecuteFeature} />
      ))}
    </>
  );
};

export default SmartFeatures;
