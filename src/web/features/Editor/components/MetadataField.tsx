import { useId, useRef, useState } from "react";
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
  suggestions?: string[];
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
  suggestions = [],
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const showSuggestions = !disabled && !suggestionsDismissed && suggestions.length > 0;
  const displayError = !!error;

  function dismissSuggestions() {
    inputRef.current?.focus();
    setSuggestionsDismissed(true);
  }

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
    <div className="flex w-full flex-wrap items-center gap-2">
      <Input
        ref={inputRef}
        id={inputId}
        type="text"
        disabled={disabled}
        placeholder={value ? undefined : placeholder || label}
        value={value ?? ""}
        onFocus={() => setSuggestionsDismissed(false)}
        onChange={(e) => {
          setSuggestionsDismissed(false);
          onChange(e.target.value);
        }}
        className={cn(
          // grow-999 lets the input soak up the row so an inline action stays
          // at its content width; once the row wraps, the action sits alone on
          // its line and grows to full width. min-w-32 floors the input and is
          // what forces the wrap on narrow panels (instead of collapsing it).
          "border-2 p-1 grow-999 basis-0",
          action && "min-w-32",
          displayError
            ? "border-destructive"
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
    <div
      className="group/metadata-field relative w-full items-center space-y-0.5"
      onKeyDown={(event) => {
        if (showSuggestions && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismissSuggestions();
        }
      }}
    >
      <Label htmlFor={customInput ? undefined : inputId} className={cn("text-sm", disabled && "opacity-70")}>
        {label}
        {required && <span className="text-primary ml-1">*</span>}
      </Label>
      {inputField}
      {description && !disabled && (
        <p className="text-xs text-primary/80 dark:text-primary/50">
          {description}
        </p>
      )}
      {displayError && <p className="text-xs text-destructive">{error}</p>}
      {showSuggestions && (
        <ul
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-20 hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md group-focus-within/metadata-field:block"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                // Keep the list open until the click selects the suggestion.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(suggestion);
                  dismissSuggestions();
                }}
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MetadataField;
