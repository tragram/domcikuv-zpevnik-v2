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
}

/** A labelled checkbox toggle shared by the admin table control panels. */
export function ToggleCheckbox({
  checked,
  onCheckedChange,
  label,
  icon: Icon,
  iconClassName,
  className,
}: ToggleCheckboxProps) {
  return (
    <Label
      className={cn(
        "flex items-center space-x-2 cursor-pointer group",
        className,
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(!!c)}
      />
      {Icon && <Icon className={cn("w-3.5 h-3.5", iconClassName)} />}
      <span className="text-sm font-medium whitespace-nowrap group-hover:text-primary transition-colors">
        {label}
      </span>
    </Label>
  );
}
