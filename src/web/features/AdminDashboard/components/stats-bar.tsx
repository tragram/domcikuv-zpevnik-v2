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
  /** Greys the card out, e.g. a show/hide toggle that is currently hidden. */
  dimmed?: boolean;
  /** Small pill rendered in the corner, e.g. "only" for an isolated card. */
  badge?: string;
}

export interface StatGroup {
  /** Short heading shown above the group of cards. */
  label: string;
  /** Describes the selection behaviour, e.g. "choose one" or "toggle". */
  hint?: string;
  items: StatItem[];
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
  onClick,
  active,
  dimmed,
  badge,
}: StatItem) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        "relative flex items-center gap-3 bg-card border rounded-xl p-3 shadow-sm flex-1 min-w-35 text-left transition-all",
        interactive &&
          "cursor-pointer hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary ring-2 ring-primary/30 bg-primary/5",
        dimmed && "opacity-55 hover:opacity-100",
      )}
    >
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-primary-foreground shadow-sm">
          {badge}
        </span>
      )}
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
}

function StatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}

/**
 * A compact row of summary stat cards. Used across the admin tables to give a
 * quick at-a-glance overview of the current dataset. Cards with an `onClick`
 * turn into filter toggles. Pass `groups` instead of `items` to split the cards
 * into labelled sections — useful when different cards filter different (and
 * independent) dimensions, so it's clear which selections replace each other.
 */
export function StatsBar({
  items,
  groups,
}: {
  items?: StatItem[];
  groups?: StatGroup[];
}) {
  if (groups) {
    return (
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <div className="flex items-baseline gap-2 px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{group.label}</span>
              {group.hint && (
                <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                  · {group.hint}
                </span>
              )}
            </div>
            <StatRow items={group.items} />
          </div>
        ))}
      </div>
    );
  }

  return <StatRow items={items ?? []} />;
}
