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

// 3. Circular Leading Elements (Now using standard `children`)
const Icon = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary",
      className,
    )}
  >
    {children}
  </div>
);

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

// 4. Stacked Text Body (Kept as props to strictly enforce truncation/typography)
const Body = ({
  title,
  subtitle,
  titleClass,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  titleClass?: string;
}) => (
  <div className="flex flex-col flex-1 min-w-0 justify-center gap-0.5">
    <span className={cn("truncate text-sm font-medium", titleClass)}>
      {title}
    </span>
    {subtitle && (
      <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
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
  <div
    className={cn(
      "flex-shrink-0 text-xs text-primary/80 text-right",
      className,
    )}
  >
    {children}
  </div>
);

// 6. Export as a compound component
export const RichItem = {
  Header,
  Shell,
  Icon,
  Avatar,
  Body,
  Trailing,
};
