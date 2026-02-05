import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as React from "react";

import { cn } from "~/lib/utils";

import { getInitials } from "~/lib/utils";

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  );
}

type AvatarWithFallbackProps = {
  avatarSrc: string | undefined;
  fallbackStr: string;
  avatarClassName?: string;
  fallbackClassName?: string;
};

const AvatarWithFallback = ({
  avatarSrc,
  fallbackStr,
  avatarClassName = "",
  fallbackClassName = "",
}: AvatarWithFallbackProps) => {
  return (
    <Avatar className={cn("h-12 w-12", avatarClassName)}>
      <AvatarImage src={avatarSrc} alt={fallbackStr} />
      <AvatarFallback className={cn("text-sm", fallbackClassName)}>
        {getInitials(fallbackStr)}
      </AvatarFallback>
    </Avatar>
  );
};

export { Avatar, AvatarFallback, AvatarImage, AvatarWithFallback };
