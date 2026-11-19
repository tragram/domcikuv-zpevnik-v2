import { useId, type ReactNode } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

export function VersionPublicationOptions({ children }: { children: ReactNode }) {
  return (
    <fieldset className="grid w-full min-w-0 gap-3 rounded-lg border border-border bg-background/30 px-3 pt-2 pb-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Publication options</legend>
      {children}
    </fieldset>
  );
}

export function PublicationOption({ label, description, checked, disabled, onCheckedChange }: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <Label
      htmlFor={id}
      className={cn(
        "gap-3 leading-snug",
        description ? "items-start" : "items-center",
        disabled ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer",
      )}
    >
      <Checkbox
        id={id}
        aria-labelledby={`${id}-label`}
        aria-describedby={descriptionId}
        className={description ? "mt-0.5" : undefined}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="min-w-0 space-y-1">
        <span id={`${id}-label`} className="block">{label}</span>
        {description && <span id={descriptionId} className="block text-tiny font-normal leading-tight text-muted-foreground">{description}</span>}
      </span>
    </Label>
  );
}
