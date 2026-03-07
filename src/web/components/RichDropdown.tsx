import type { ReactNode } from "react";
import { DropdownMenuLabel } from "./ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { AvatarWithFallback } from "~/components/ui/avatar";

// 1. Unified Section Header
const Header = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <DropdownMenuLabel
    className={cn(
      "text-xs font-semibold uppercase tracking-wider text-primary/70 pb-2",
      className,
    )}
  >
    {children}
  </DropdownMenuLabel>
);

// 2. The Flex Shell
const Shell = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex items-center gap-3 w-full min-w-0", className)}>
    {children}
  </div>
);

// 3. Circular Leading Elements
const Icon = ({
  children,
  size = 8,
  className,
}: {
  children: ReactNode;
  size?: number;
  className?: string;
}) => {
  // Automatically scale the inner SVG so it fits neatly inside smaller wrappers
  const innerSizeClass = size <= 6 ? "[&_svg]:!size-3.5" : "[&_svg]:!size-4";

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary dark:bg-primary/30 *:stroke-current! *:text-white! dark:*:text-primary!",
        `size-${size}`,
        innerSizeClass,
        className,
      )}
    >
      {children}
    </div>
  );
};

const Avatar = ({
  src,
  fallback,
  className,
}: {
  src?: string;
  fallback: string;
  className?: string;
}) => (
  <AvatarWithFallback
    avatarSrc={src}
    fallbackStr={fallback}
    avatarClassName={cn("h-8 w-8 rounded-full flex-shrink-0", className)}
    fallbackClassName="text-xs rounded-full"
  />
);

// 4. Stacked Text Body
const Body = ({
  title,
  subtitle,
  titleClass,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  titleClass?: string;
}) => (
  <div className="flex flex-col flex-1 justify-center min-w-0">
    <span className={cn("truncate font-medium", titleClass)}>{title}</span>
    {subtitle && (
      <span className="text-tiny font-normal text-muted-foreground leading-tight line-clamp-2">
        {subtitle}
      </span>
    )}
  </div>
);

// 5. Trailing Elements
const Trailing = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("text-xs text-primary/80 text-right", className)}>
    {children}
  </div>
);

// 6. Standard Export
export const RichItem = {
  Header,
  Shell,
  Icon,
  Avatar,
  Body,
  Trailing,
};

// 7. Compact Export (Overrides defaults for tighter menus)
export const CompactItem = {
  Header,
  Shell: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <Shell className={cn("gap-2 text-[0.8rem]", className)}>{children}</Shell>
  ),
  Icon: ({
    children,
    size = 6,
    className,
  }: {
    children: ReactNode;
    size?: number;
    className?: string;
  }) => (
    <Icon size={size} className={className}>
      {children}
    </Icon>
  ),
  Avatar: ({
    src,
    fallback,
    className,
  }: {
    src?: string;
    fallback: string;
    className?: string;
  }) => (
    <Avatar
      src={src}
      fallback={fallback}
      className={cn("h-6 w-6", className)}
    />
  ),
  Body: ({
    title,
    subtitle,
    titleClass,
  }: {
    title: string;
    subtitle?: string;
    titleClass?: string;
  }) => (
    <Body
      title={title}
      subtitle={subtitle}
      titleClass={cn("font-normal", titleClass)}
    />
  ),
  Trailing,
};
