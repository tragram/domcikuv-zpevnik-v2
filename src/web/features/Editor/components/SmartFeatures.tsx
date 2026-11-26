import { EditorInfo } from "./EditorInfo";
import { Button } from "~/components/ui/button";
import type { EvaluatedFeature, SmartFeature } from "../Editor";

interface SmartFeatureItemProps {
  feature: EvaluatedFeature;
  isProcessing: boolean;
  onExecuteFeature: (feature: SmartFeature) => void;
}

function SmartFeatureItem({ feature, isProcessing, onExecuteFeature }: SmartFeatureItemProps) {
  const disabled = !feature.isEnabled || isProcessing;
  const label = isProcessing && feature.isEnabled ? feature.loadingLabel : feature.label;
  const help = (
    <EditorInfo label={feature.label}>
      <div>{feature.description}</div>
      {!feature.isEnabled && <p className="font-medium text-foreground">{feature.disabledReason}</p>}
    </EditorInfo>
  );

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
  onExecuteFeature: (feature: SmartFeature) => void;
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
