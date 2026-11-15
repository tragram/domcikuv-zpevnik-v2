// Shared surface for version details, transposition, and toolbar settings.
// Keep opacity and border here so the panels stay consistent in both themes.
export const songPanelClassName =
  "song-panel rounded-2xl border-2 border-primary/60 dark:border-primary/60 bg-glass/70 backdrop-blur-md shadow-lg";

// Account for the padding around the toolbar's trigger buttons.
export const toolbarPanelPlacement = {
  align: "end",
  side: "bottom",
  sideOffset: 24,
  collisionPadding: 16,
} as const;
