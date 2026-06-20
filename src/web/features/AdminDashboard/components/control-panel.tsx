import React from "react";
import { cn } from "~/lib/utils";
import { TableToolbar } from "./shared/table-toolbar";

interface ControlPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  /** Rendered inside the bordered card, above the search toolbar (e.g. stats). */
  header?: React.ReactNode;
  /** Extra controls rendered inline next to the search box (e.g. a filter). */
  toolbarChildren?: React.ReactNode;
  /** The body of the panel (toggles, filters, a table, etc.). */
  children?: React.ReactNode;
  /** Overrides the default (primary) border, e.g. for a subtler card. */
  className?: string;
  /** Where the search toolbar sits relative to the body. Defaults to "top". */
  searchPosition?: "top" | "bottom";
}

/**
 * The bordered card shell shared by the admin tables: an optional header
 * (e.g. the stats bar), a search toolbar, and an arbitrary control body below —
 * all enclosed by a single border.
 */
export function ControlPanel({
  searchTerm,
  onSearchChange,
  header,
  toolbarChildren,
  children,
  className,
  searchPosition = "top",
}: ControlPanelProps) {
  const atBottom = searchPosition === "bottom";
  const toolbar = (
    <div className={cn("p-4 bg-muted/10", atBottom ? "border-t" : "border-b")}>
      <TableToolbar searchTerm={searchTerm} onSearchChange={onSearchChange}>
        {toolbarChildren}
      </TableToolbar>
    </div>
  );
  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm overflow-hidden flex flex-col",
        className ?? "border-3 border-primary",
      )}
    >
      {header && <div className="p-4 border-b bg-muted/10">{header}</div>}
      {!atBottom && toolbar}
      {children}
      {atBottom && toolbar}
    </div>
  );
}
