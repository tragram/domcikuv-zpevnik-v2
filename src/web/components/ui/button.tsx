import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 focus-visible:border-ring aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        "destructive-outline":
          "border border-destructive/60 bg-button-background text-destructive shadow-xs hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive",
        outline:
          "border bg-button-background shadow-xs hover:bg-control-hover hover:text-accent-foreground dark:border-input",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        toolbar: "focus-visible:outline-2 focus-visible:-outline-offset-2",
        circular:
          "bg-primary text-primary-foreground rounded-full outline-2 shadow-md" ,
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
      },
      isActive: {
        true: "bg-primary text-primary-foreground hover:bg-control-active-hover outline-background",
        false:
          "bg-control-surface text-primary hover:bg-control-hover outline-border",
      },
    },
    compoundVariants: [
      {
        variant: "toolbar",
        className: "bg-transparent text-primary hover:bg-transparent hover:text-foreground",
      },
    ],
    defaultVariants: {
      isActive: false,
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  isActive,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  const activeState =
    isActive === undefined && (variant === "destructive" || variant === "destructive-outline")
      ? null
      : isActive;

  return (
    <Comp
      data-slot="button"
      data-active={isActive === true || undefined}
      className={cn(buttonVariants({ variant, isActive: activeState, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
