import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { ValidationResult } from "./validationUtils";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface MetadataFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  description?: string;
  onChange: (value: string) => void;
  validator?: (value: string) => ValidationResult;
  required?: boolean;
  modified: boolean;
}

const MetadataField: React.FC<MetadataFieldProps> = ({
  label,
  value,
  placeholder,
  description,
  onChange,
  validator,
  required = false,
  modified,
}) => {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    isValid: true,
  });
  
  // Run validation when value changes
  useEffect(() => {
    if (validator && value) {
      setValidationResult(validator(value));
    }
  }, [value, validator]);

  const displayError = !validationResult.isValid;

  return (
    <div className="w-full items-center space-y-0.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </Label>
      <Input
        placeholder={value ? undefined : placeholder || label}
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        className={cn(
          "border-2 p-1",
          displayError
            ? "border-red-600"
            : "border-primary/50 dark:border-muted focus:border-primary focus:bg-primary/30",
          modified ? "!bg-primary/30" : ""
        )}
      />
      {description && (
        <p className="text-xs text-primary/80 dark:text-primary/50">
          {description}
        </p>
      )}
      {displayError && (
        <p className="text-xs text-red-600">{validationResult.errorMessage}</p>
      )}
    </div>
  );
};

export default MetadataField;
