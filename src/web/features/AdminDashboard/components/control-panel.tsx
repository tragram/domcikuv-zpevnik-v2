import React from "react";
import { cn } from "~/lib/utils";
import { TableToolbar } from "./shared/table-toolbar";

interface ControlPanelProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  /** Extra controls rendered inline next to the search box (e.g. a filter). */
  toolbarChildren?: React.ReactNode;
  /** The body of the panel (toggles, filters, a table, etc.). */
  children?: React.ReactNode;
  /** Overrides the default (primary) border, e.g. for a subtler card. */
  className?: string;
}

/**
 * The bordered card shell shared by the admin tables: a search toolbar header
 * on top and an arbitrary control body below.
 */
export function ControlPanel({
  searchTerm,
  onSearchChange,
  toolbarChildren,
  children,
  className,
}: ControlPanelProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm overflow-hidden flex flex-col",
        className ?? "border-3 border-primary",
      )}
    >
      <div className="p-4 border-b bg-muted/10">
        <TableToolbar searchTerm={searchTerm} onSearchChange={onSearchChange}>
          {toolbarChildren}
        </TableToolbar>
      </div>
      {children}
    </div>
  );
}
