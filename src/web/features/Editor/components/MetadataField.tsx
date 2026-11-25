import { useId, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import { EditorInfo } from "./EditorInfo";

interface MetadataFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  description?: string;
  counter?: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  customInput?: React.ReactElement;
  modified: boolean;
  unit?: string;
  inputMode?: "numeric";
  action?: React.ReactNode;
  disabled?: boolean;
  suggestions?: string[];
}

const MetadataField: React.FC<MetadataFieldProps> = ({
  label,
  value,
  placeholder,
  description,
  counter,
  onChange,
  error,
  required = false,
  customInput = null,
  modified,
  action,
  unit,
  inputMode,
  disabled = false,
  suggestions = [],
}) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false);
  const showSuggestions = !disabled && !suggestionsDismissed && suggestions.length > 0;
  const displayError = !!error;
  const describedBy = [counter && `${inputId}-counter`, displayError && `${inputId}-error`].filter(Boolean).join(" ") || undefined;

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
      <div className="relative min-w-0">
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode={inputMode}
          aria-invalid={displayError}
          aria-required={required}
          aria-describedby={describedBy}
          disabled={disabled}
          placeholder={value ? undefined : placeholder || label}
          value={value ?? ""}
          onFocus={() => setSuggestionsDismissed(false)}
          onChange={(e) => {
            setSuggestionsDismissed(false);
            onChange(e.target.value);
          }}
          className={cn("h-10 rounded-lg border-input/50 bg-card px-3 shadow-none hover:border-foreground/60 focus-visible:border-ring focus-visible:ring-2 dark:bg-card", unit && "pr-11")}
        />
        {unit && <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">{unit}</span>}
      </div>
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
      <div className="flex min-h-6 flex-wrap items-center gap-x-1">
      <Label htmlFor={customInput ? undefined : inputId} className={cn("gap-1.5 text-xs font-semibold tracking-wide", disabled && "opacity-70")}>
        {label}
        {modified && <span className="size-1.5 rounded-full bg-primary" title="Modified"><span className="sr-only">Modified</span></span>}
      </Label>
      {(description || disabled) && <EditorInfo label={label}>
        {disabled && <span className="block font-medium">Edit the directive in the lyrics editor to change this value.</span>}
        {description}
      </EditorInfo>}
      {action && <div className="ml-auto">{action}</div>}
      </div>
      {innerInput}
      {counter && <p id={`${inputId}-counter`} className="text-right text-xs text-muted-foreground">{counter}</p>}
      {displayError && <p id={`${inputId}-error`} className="text-xs text-destructive">{error}</p>}
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
