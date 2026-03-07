import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface MetadataFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  description?: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  customInput?: React.ReactElement;
  modified: boolean;
  action?: React.ReactNode;
  disabled?: boolean;
}

const MetadataField: React.FC<MetadataFieldProps> = ({
  label,
  value,
  placeholder,
  description,
  onChange,
  error,
  required = false,
  customInput = null,
  modified,
  action,
  disabled = false,
}) => {
  const displayError = !!error;

  const innerInput = customInput ? (
    <div
      className={cn(
        "flex w-full",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {customInput}
    </div>
  ) : (
    <div className="flex w-full items-center gap-2">
      <Input
        disabled={disabled}
        placeholder={value ? undefined : placeholder || label}
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={cn(
          "border-2 p-1 flex-1",
          displayError
            ? "border-red-600"
            : "border-primary/50 dark:border-muted focus:border-primary focus:bg-primary/30",
          modified ? "!bg-primary/30" : "",
          disabled && "opacity-50 cursor-not-allowed bg-muted",
        )}
      />
      {action}
    </div>
  );

  const inputField = disabled ? (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div tabIndex={0} className="w-full focus:outline-none cursor-help">
            <div className="pointer-events-none">{innerInput}</div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>This field is controlled by a directive in the text editor.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    innerInput
  );

  return (
    <div className="w-full items-center space-y-0.5">
      <Label className={cn("text-sm", disabled && "opacity-70")}>
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </Label>
      {inputField}
      {description && !disabled && (
        <p className="text-xs text-primary/80 dark:text-primary/50">
          {description}
        </p>
      )}
      {displayError && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default MetadataField;
