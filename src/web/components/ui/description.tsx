import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

export function Description({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      {...props}
      className={cn(
        "text-tiny font-normal leading-tight text-muted-foreground",
        className,
      )}
    />
  );
}
