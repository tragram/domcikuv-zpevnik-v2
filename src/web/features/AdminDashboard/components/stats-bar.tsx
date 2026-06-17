import React from "react";
import { cn } from "~/lib/utils";

export interface StatItem {
  label: string;
  value: number | string;
  icon: React.ElementType;
  /** Optional class applied to the icon badge (e.g. a colour). */
  className?: string;
}

/**
 * A compact row of summary stat cards. Used across the admin tables to give a
 * quick at-a-glance overview of the current dataset.
 */
export function StatsBar({ items }: { items: StatItem[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map(({ label, value, icon: Icon, className }) => (
        <div
          key={label}
          className="flex items-center gap-3 bg-card border rounded-xl p-3 shadow-sm flex-1 min-w-[140px]"
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
        </div>
      ))}
    </div>
  );
}
