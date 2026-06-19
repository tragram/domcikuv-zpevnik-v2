import React from "react";
import { cn } from "~/lib/utils";

export interface StatItem {
  label: string;
  value: number | string;
  icon: React.ElementType;
  /** Optional class applied to the icon badge (e.g. a colour). */
  className?: string;
  /** When provided, the card becomes a filter toggle for this stat. */
  onClick?: () => void;
  /** Highlights the card as the currently active filter. */
  active?: boolean;
}

/**
 * A compact row of summary stat cards. Used across the admin tables to give a
 * quick at-a-glance overview of the current dataset. When an item supplies an
 * `onClick`, its card turns into a filter toggle and reflects its `active` state.
 */
export function StatsBar({ items }: { items: StatItem[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(({ label, value, icon: Icon, className, onClick, active }) => {
        const interactive = !!onClick;
        return (
          <button
            key={label}
            type="button"
            onClick={onClick}
            disabled={!interactive}
            aria-pressed={interactive ? active : undefined}
            className={cn(
              "flex items-center gap-3 bg-card border rounded-xl p-3 shadow-sm flex-1 min-w-35 text-left transition-all",
              interactive &&
                "cursor-pointer hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "border-primary ring-2 ring-primary/30 bg-primary/5",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0",
                className,
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold leading-none">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
