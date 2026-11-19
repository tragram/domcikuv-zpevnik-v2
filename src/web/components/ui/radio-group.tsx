import * as React from "react"
import { CircleIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "~/lib/utils"
import { Label } from "./label"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="relative flex items-center justify-center"
      >
        <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

function RadioGroupOption({
  value,
  label,
  description,
}: {
  value: string
  label: string
  description: string
}) {
  const id = React.useId()

  return (
    <Label
      htmlFor={id}
      className="cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/30 p-3 leading-snug has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/10 has-disabled:cursor-not-allowed has-disabled:opacity-60"
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} />
      <span className="min-w-0 space-y-1">
        <span id={`${id}-label`} className="block">{label}</span>
        <span id={`${id}-description`} className="block font-normal text-muted-foreground">{description}</span>
      </span>
    </Label>
  )
}

export { RadioGroup, RadioGroupItem, RadioGroupOption }
