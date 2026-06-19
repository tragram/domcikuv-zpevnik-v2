import React from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

interface ToggleCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  icon?: React.ElementType;
  /** Optional class applied to the icon (e.g. a colour). */
  iconClassName?: string;
  /** Optional class applied to the wrapping label (e.g. a boxed look). */
  className?: string;
  /** Greys out and blocks the toggle, e.g. when it is being overridden. */
  disabled?: boolean;
  /** Optional explanation shown on hover (e.g. why it is disabled). */
  title?: string;
}

/** A labelled checkbox toggle shared by the admin table control panels. */
export function ToggleCheckbox({
  checked,
  onCheckedChange,
  label,
  icon: Icon,
  iconClassName,
  className,
  disabled,
  title,
}: ToggleCheckboxProps) {
  return (
    <Label
      title={title}
      className={cn(
        "flex items-center space-x-2 group",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer",
        className,
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onCheckedChange(!!c)}
      />
      {Icon && <Icon className={cn("w-3.5 h-3.5", iconClassName)} />}
      <span
        className={cn(
          "text-sm font-medium whitespace-nowrap transition-colors",
          !disabled && "group-hover:text-primary",
        )}
      >
        {label}
      </span>
    </Label>
  );
}
